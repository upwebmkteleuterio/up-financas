import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthenticatedUser } from "./auth.ts";
import { loadContext, loadCustomSystemPrompt } from "./context.ts";
import { executeDraft, normalizeDraft } from "./finance-domain.ts";
import { createDiagnostics, diagnosticsResponse, logError, recordStage } from "./diagnostics.ts";
import { askModel } from "./model.ts";
import { sanitizeChatRequest } from "./protocol.ts";
import type { FinanceContext } from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const diagnostics = createDiagnostics(false);
  const respond = (body: Record<string, unknown>, status = 200) => jsonResponse({ ...body, requestId, ...diagnosticsResponse(diagnostics) }, status);
  const finish = (body: Record<string, unknown>, status = 200, stageStatus: "ok" | "error" = "ok") => {
    const responseStartedAt = performance.now();
    recordStage(diagnostics, "response", stageStatus, responseStartedAt);
    return respond(body, status);
  };

  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return finish({ kind: "error", message: "Método não permitido." }, 405, "error");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !supabaseAnonKey) return finish({ kind: "error", message: "Configuração do Supabase indisponível." }, 500, "error");
  if (!authorization?.startsWith("Bearer ")) return finish({ kind: "error", message: "Não autenticado." }, 401, "error");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } });

  try {
    const user = await getAuthenticatedUser(request, supabase);
    const body = sanitizeChatRequest(await request.json());
    diagnostics.enabled = body.diagnostics === true;

    const contextStartedAt = performance.now();
    let context: FinanceContext;
    let customPrompt: string | null = null;
    try {
      context = await loadContext(supabase, user.id);
      if (body.mode !== "execute") customPrompt = await loadCustomSystemPrompt(supabase, user.id);
      recordStage(diagnostics, "context", "ok", contextStartedAt);
    } catch {
      recordStage(diagnostics, "context", "error", contextStartedAt);
      logError(requestId, "context load failed");
      throw new Error("Não foi possível carregar o contexto financeiro.");
    }

    if (body.mode === "execute") {
      const validationStartedAt = performance.now();
      if (body.confirmed !== true) {
        recordStage(diagnostics, "validation", "error", validationStartedAt);
        return finish({ kind: "error", message: "A confirmação explícita é necessária para executar o lançamento." }, 400, "error");
      }
      const normalized = normalizeDraft(body.draft || {}, context, false);
      recordStage(diagnostics, "validation", normalized.missing.length || !normalized.draft ? "error" : "ok", validationStartedAt);
      if (normalized.missing.length || !normalized.draft) {
        return finish({ kind: "error", message: `Lançamento inválido: ${normalized.missing.join(", ")}.`, categoryOptions: normalized.options }, 400, "error");
      }
      const transactionId = await executeDraft(supabase, user.id, normalized.draft);
      return finish({ kind: "message", message: "Lançamento confirmado e salvo com segurança.", transactionId, activities: [] });
    }

    const result = await askModel(supabase, user.id, context, body, customPrompt, requestId, diagnostics);
    return finish(result as unknown as Record<string, unknown>);
  } catch {
    logError(requestId, "request failed");
    return finish({ kind: "error", message: "Não foi possível processar o pedido." }, 200, "error");
  }
});
