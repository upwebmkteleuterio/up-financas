import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthenticatedUser } from "./auth.ts";
import { loadContext, loadCustomSystemPrompt } from "./context.ts";
import { executeDraft, normalizeDraft } from "./finance-domain.ts";
import { askModel } from "./model.ts";
import { sanitizeChatRequest } from "./protocol.ts";

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
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ kind: "error", message: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ kind: "error", message: "Configuração do Supabase indisponível." }, 500);
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ kind: "error", message: "Não autenticado." }, 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } });

  try {
    const user = await getAuthenticatedUser(request, supabase);
    const body = sanitizeChatRequest(await request.json());
    const context = await loadContext(supabase, user.id);
    if (body.mode === "execute") {
      if (body.confirmed !== true) return jsonResponse({ kind: "error", message: "A confirmação explícita é necessária para executar o lançamento." }, 400);
      const normalized = normalizeDraft(body.draft || {}, context, false);
      if (normalized.missing.length || !normalized.draft) return jsonResponse({ kind: "error", message: `Lançamento inválido: ${normalized.missing.join(", ")}.`, categoryOptions: normalized.options }, 400);
      const transactionId = await executeDraft(supabase, user.id, normalized.draft);
      return jsonResponse({ kind: "message", message: "Lançamento confirmado e salvo com segurança.", transactionId, activities: [] });
    }
    const customPrompt = await loadCustomSystemPrompt(supabase, user.id);
    return jsonResponse(await askModel(supabase, user.id, context, body, customPrompt));
  } catch (error) {
    console.error("[ai-finance-chat] request failed", error instanceof Error ? error.name : "unknown error");
    return jsonResponse({ kind: "error", message: error instanceof Error ? error.message : "Não foi possível processar o pedido." }, 400);
  }
});
