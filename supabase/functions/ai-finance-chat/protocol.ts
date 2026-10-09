import type { ChatRequest, ModelResponse, TransactionDraft } from "./types.ts";

export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function sanitizeChatRequest(input: unknown): ChatRequest {
  if (!isRecord(input)) throw new Error("Pedido inválido.");
  const messages = Array.isArray(input.messages)
    ? input.messages.filter(isRecord)
      .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
      .slice(-12)
      .map((message) => ({ role: message.role as "user" | "assistant", content: (message.content as string).slice(0, 2000) }))
    : undefined;
  return {
    mode: input.mode === "execute" ? "execute" : "chat",
    message: typeof input.message === "string" ? input.message.slice(0, 4000) : undefined,
    messages,
    drafts: Array.isArray(input.drafts)
      ? input.drafts.slice(0, 50).map((draft) => isRecord(draft) ? draft as TransactionDraft : {})
      : undefined,
    draft: isRecord(input.draft) ? input.draft as TransactionDraft : undefined,
    operationId: typeof input.operationId === "string" && /^[A-Za-z0-9:_-]{1,120}$/.test(input.operationId)
      ? input.operationId
      : undefined,
    confirmed: input.confirmed === true,
    diagnostics: input.diagnostics === true,
  };
}

const toModelResponse = (parsed: Record<string, unknown>): ModelResponse | null => {
  const kind = parsed.kind;
  if (kind !== "message" && kind !== "proposal" && kind !== "missing") return null;
  return {
    kind,
    message: typeof parsed.message === "string" ? parsed.message : undefined,
    missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields.filter((field): field is string => typeof field === "string").slice(0, 8) : undefined,
    missingByItem: Array.isArray(parsed.missingByItem)
      ? parsed.missingByItem
        .filter(isRecord)
        .map((item, index) => ({
          index: typeof item.index === "number" && Number.isInteger(item.index) && item.index >= 0 ? item.index : index,
          label: typeof item.label === "string" && item.label.trim() ? item.label.trim().slice(0, 120) : `Item ${index + 1}`,
          missingFields: Array.isArray(item.missingFields)
            ? item.missingFields.filter((field): field is string => typeof field === "string").slice(0, 8)
            : [],
        }))
        .slice(0, 50)
      : undefined,
    categoryOptions: Array.isArray(parsed.categoryOptions) ? parsed.categoryOptions.filter((option): option is string => typeof option === "string").slice(0, 50) : undefined,
    drafts: Array.isArray(parsed.drafts)
      ? parsed.drafts.slice(0, 50).map((draft) => isRecord(draft) ? draft as TransactionDraft : {})
      : undefined,
  };
};

const parseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export function parseModelResponse(content: string): ModelResponse | null {
  const withoutFences = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const candidates = [withoutFences];
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(withoutFences.slice(start, end + 1));
  for (const candidate of candidates) {
    const parsed = parseJsonObject(candidate);
    if (!parsed) continue;
    const response = toModelResponse(parsed);
    if (response) return response;
  }
  return null;
}

export const sanitizeVisibleMessage = (message: string) => message.replace(/\brascunho(?:s)?\b/gi, "lançamento pronto para confirmação").slice(0, 2000);
