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
  if (request.method !== "POST") return finish({ kind: "error", code: "METHOD_NOT_ALLOWED", message: "Método não permitido." }, 405, "error");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !supabaseAnonKey) return finish({ kind: "error", code: "CONFIG_ERROR", message: "Configuração do Supabase indisponível." }, 500, "error");
  if (!authorization?.startsWith("Bearer ")) return finish({ kind: "error", code: "UNAUTHENTICATED", message: "Não autenticado." }, 401, "error");
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
        return finish({ kind: "error", code: "CONFIRMATION_REQUIRED", message: "A confirmação explícita é necessária para executar o lançamento." }, 400, "error");
      }
      const requestedDrafts = body.drafts?.length ? body.drafts : body.draft ? [body.draft] : [];
      if (requestedDrafts.length === 0) {
        recordStage(diagnostics, "validation", "error", validationStartedAt);
        return finish({ kind: "error", code: "NO_DRAFTS", message: "É necessário informar pelo menos um lançamento." }, 400, "error");
      }
      const normalizedDrafts = requestedDrafts.map((draft) => normalizeDraft(draft, context, false));
      const invalidItems = normalizedDrafts
        .map((normalized, index) => ({
          index,
          label: typeof requestedDrafts[index].description === "string" && requestedDrafts[index].description.trim()
            ? requestedDrafts[index].description.trim()
            : typeof requestedDrafts[index].category === "string" && requestedDrafts[index].category.trim()
              ? requestedDrafts[index].category.trim()
              : `Item ${index + 1}`,
          missingFields: normalized.missing,
        }))
        .filter((item) => item.missingFields.length > 0);
      recordStage(diagnostics, "validation", invalidItems.length > 0 ? "error" : "ok", validationStartedAt);
      if (invalidItems.length > 0) {
        return finish({
          kind: "error",
          code: "VALIDATION_ERROR",
          message: "Um ou mais lançamentos são inválidos ou estão incompletos.",
          missingByItem: invalidItems,
          categoryOptions: [...new Set(normalizedDrafts.flatMap((normalized) => normalized.options))],
        }, 400, "error");
      }
      const transactionIds = await executeDraft(supabase, normalizedDrafts.map((normalized) => normalized.draft!), body.operationId);
      return finish({
        kind: "message",
        message: "Lançamentos confirmados e salvos com segurança.",
        transactionIds,
        transactionId: transactionIds[0],
        createdCount: normalizedDrafts.length,
        activities: [],
      });
    }

    const result = await askModel(supabase, user.id, context, body, customPrompt, requestId, diagnostics);
    return finish(result as unknown as Record<string, unknown>);
  } catch (error) {
    logError(requestId, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return finish({ kind: "error", code: "INTERNAL_ERROR", message: "Não foi possível processar o pedido." }, 200, "error");
  }
});
