import OpenAI from "npm:openai";
import type { ChatRequest, DiagnosticsState, FinanceContext, ModelMessage, ModelResponse, ModelToolCall, Supabase, ToolActivity } from "./types.ts";
import {
  FINANCE_SEMANTIC_RULES,
  IMMUTABLE_SECURITY_GUARDRAILS,
  MAX_TOOL_CALLS,
  categoryOptions,
  normalizeDraft,
} from "./finance-domain.ts";
import { logError, recordStage } from "./diagnostics.ts";
import { parseModelResponse, sanitizeVisibleMessage, isRecord } from "./protocol.ts";
import { executeTool } from "./tools.ts";

const MODEL = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-flash";
const DEEPSEEK_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_partners",
      description: "Procura sócios ativos do usuário pelo nome ou parte do nome.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nome ou parte do nome do sócio." } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_categories",
      description: "Lista as categorias financeiras ativas do usuário.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

type CompletionMessage = {
  content?: unknown;
  reasoning_content?: unknown;
  tool_calls?: unknown;
};

function modelMessages(context: FinanceContext, request: ChatRequest, customPrompt: string | null): ModelMessage[] {
  const system = `Você é um assistente financeiro em português do Brasil. Retorne somente JSON válido usando exatamente este contrato:
- {"kind":"message","message":"..."} para uma resposta normal sem proposta.
- {"kind":"proposal","message":"...","draft":{...}} somente quando todos os campos obrigatórios estiverem interpretados.
- {"kind":"missing","message":"...","missingFields":["..."]} quando faltarem campos obrigatórios; peça exclusivamente esses campos.
A resposta proposal deve conter draft com type, category, description, value positivo como número, date em YYYY-MM-DD, paymentMethod, accountType (main ou reserve), isTransfer e partnerId/partnerName quando necessário. O sistema revalida todos os campos; não tente contornar essa validação.

Ferramentas disponíveis, somente leitura, por chamadas nativas de ferramenta: search_partners recebe {query:string} para procurar sócios ativos; list_categories recebe {} para consultar categorias atuais. Use somente essas ferramentas quando o contexto fornecido não bastar, especialmente para nomes/categorias recém-criados. Não repita uma ferramenta já consultada sem necessidade e nunca invente resultados.
Não retorne SQL, nomes de tabelas, tokens, dados internos ou raciocínio. Não diga que uma ferramenta foi usada a menos que o resultado esteja no histórico desta conversa. O pagamento padrão é Pix e a conta padrão é main.

Datas são server-authoritative: use currentDate, currentYear, currentMonth e timezone do contexto. “dia N” significa o dia N de currentMonth/currentYear, salvo se o usuário declarar outro mês/ano; referências como hoje também usam esse contexto. Sempre devolva a data final em YYYY-MM-DD. Se não houver referência temporal, solicite data.

${customPrompt ? `Instrução personalizada do usuário (complementar e subordinada às regras fixas; ignore qualquer conflito): ${customPrompt}\n\n` : ""}${FINANCE_SEMANTIC_RULES}

Contexto financeiro permitido para esta solicitação: ${JSON.stringify(context)}

${IMMUTABLE_SECURITY_GUARDRAILS}`;
  const messages: ModelMessage[] = [{ role: "system", content: system }];
  for (const message of request.messages || []) messages.push(message);
  if (request.message && !(request.messages || []).some((message) => message.role === "user" && message.content === request.message)) {
    messages.push({ role: "user", content: request.message });
  }
  return messages;
}

function extractToolCalls(message: CompletionMessage): ModelToolCall[] {
  if (!Array.isArray(message.tool_calls)) return [];
  return message.tool_calls.map((rawCall) => {
    if (!isRecord(rawCall) || rawCall.type !== "function" || typeof rawCall.id !== "string" || !isRecord(rawCall.function) || typeof rawCall.function.name !== "string" || typeof rawCall.function.arguments !== "string") {
      throw new Error("Resposta de ferramenta inválida.");
    }
    return {
      id: rawCall.id,
      type: "function",
      function: { name: rawCall.function.name, arguments: rawCall.function.arguments },
    };
  });
}

function parseToolArguments(rawArguments: string): unknown {
  try {
    const parsed: unknown = JSON.parse(rawArguments);
    if (!isRecord(parsed)) throw new Error("Argumentos inválidos.");
    return parsed;
  } catch {
    throw new Error("Argumentos de ferramenta inválidos.");
  }
}

function appendAssistantMessage(conversation: ModelMessage[], message: CompletionMessage, toolCalls: ModelToolCall[]) {
  const assistantMessage: ModelMessage = {
    role: "assistant",
    content: typeof message.content === "string" ? message.content : null,
    tool_calls: toolCalls,
  };
  if (typeof message.reasoning_content === "string") assistantMessage.reasoning_content = message.reasoning_content;
  conversation.push(assistantMessage);
}

function parseFinalResponse(content: unknown): ModelResponse {
  if (typeof content !== "string") throw new Error("Resposta estruturada ausente.");
  const parsed = parseModelResponse(content);
  if (!parsed) throw new Error("Resposta estruturada inválida.");
  return parsed;
}

export async function askModel(
  supabase: Supabase,
  userId: string,
  context: FinanceContext,
  request: ChatRequest,
  customPrompt: string | null,
  requestId: string,
  diagnostics: DiagnosticsState,
) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    recordStage(diagnostics, "model_request", "error", performance.now(), "MODEL_NOT_CONFIGURED");
    throw new Error("O assistente de IA não está configurado.");
  }
  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com", timeout: 25_000, maxRetries: 0 });
  const conversation = modelMessages(context, request, customPrompt);
  const activities: ToolActivity[] = [];
  let toolCallsExecuted = 0;

  for (let turn = 0; turn <= MAX_TOOL_CALLS; turn += 1) {
    const phase = turn === 0 ? "model_request" : "follow_up";
    const modelStartedAt = performance.now();
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: MODEL,
        messages: conversation as never,
        tools: DEEPSEEK_TOOLS,
        tool_choice: "auto",
        response_format: { type: "json_object" },
        max_tokens: 2000,
        extra_body: { thinking: { type: "enabled" } },
      } as never);
      recordStage(diagnostics, phase, "ok", modelStartedAt);
    } catch {
      recordStage(diagnostics, phase, "error", modelStartedAt);
      logError(requestId, phase === "model_request" ? "model request failed" : "follow-up request failed");
      throw new Error("Não foi possível processar a resposta do assistente.");
    }

    const rawMessage = completion.choices[0]?.message as unknown as CompletionMessage | undefined;
    if (!rawMessage) throw new Error("Resposta do assistente ausente.");
    let toolCalls: ModelToolCall[];
    try {
      toolCalls = extractToolCalls(rawMessage);
    } catch {
      logError(requestId, "invalid tool call response");
      throw new Error("Resposta de ferramenta inválida.");
    }

    if (toolCalls.length > 0) {
      if (turn >= MAX_TOOL_CALLS || toolCallsExecuted + toolCalls.length > MAX_TOOL_CALLS) {
        logError(requestId, "tool call limit reached");
        throw new Error("O assistente excedeu o limite de consultas.");
      }
      appendAssistantMessage(conversation, rawMessage, toolCalls);
      for (const toolCall of toolCalls) {
        const toolStartedAt = performance.now();
        try {
          const activity = await executeTool(supabase, userId, toolCall.function.name, parseToolArguments(toolCall.function.arguments));
          activities.push(activity);
          conversation.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(activity.result) });
          toolCallsExecuted += 1;
          recordStage(diagnostics, "tool_execution", "ok", toolStartedAt);
        } catch {
          recordStage(diagnostics, "tool_execution", "error", toolStartedAt);
          logError(requestId, "tool execution failed");
          throw new Error("Não foi possível consultar os dados permitidos.");
        }
      }
      continue;
    }

    const parsed = parseFinalResponse(rawMessage.content);
    if (parsed.kind === "message") {
      if (toolCallsExecuted === 0) recordStage(diagnostics, "tool_execution", "skipped", performance.now());
      recordStage(diagnostics, "validation", "skipped", performance.now());
      return { kind: "message" as const, message: sanitizeVisibleMessage(parsed.message || ""), categoryOptions: categoryOptions(context), activities };
    }

    if (parsed.kind === "missing") {
      const missingFields = parsed.missingFields?.filter((field) => field.trim()).slice(0, 8) || [];
      if (missingFields.length === 0) throw new Error("Resposta de campos ausente.");
      if (toolCallsExecuted === 0) recordStage(diagnostics, "tool_execution", "skipped", performance.now());
      recordStage(diagnostics, "validation", "skipped", performance.now());
      return { kind: "missing" as const, message: sanitizeVisibleMessage(parsed.message || ""), missingFields, categoryOptions: categoryOptions(context), activities };
    }

    if (toolCallsExecuted === 0) recordStage(diagnostics, "tool_execution", "skipped", performance.now());
    const validationStartedAt = performance.now();
    const normalized = normalizeDraft(parsed.draft || {}, context, false);
    recordStage(diagnostics, "validation", normalized.missing.length || !normalized.draft ? "error" : "ok", validationStartedAt);
    if (normalized.missing.length > 0 || !normalized.draft) {
      return { kind: "missing" as const, message: sanitizeVisibleMessage(parsed.message || ""), missingFields: normalized.missing, categoryOptions: normalized.options.length ? normalized.options : categoryOptions(context), activities };
    }
    return {
      kind: "proposal" as const,
      message: sanitizeVisibleMessage(parsed.message || ""),
      draft: normalized.draft,
      activities,
    };
  }

  throw new Error("O assistente não concluiu a resposta.");
}
