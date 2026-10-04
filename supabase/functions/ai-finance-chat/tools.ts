import type { Supabase, ToolActivity } from "./types.ts";
import { unique } from "./finance-domain.ts";
import { isRecord } from "./protocol.ts";

function sanitizeSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.replace(/[\\%_*]/g, "").trim().slice(0, 120);
  return query.length > 0 ? query : null;
}

export async function executeTool(supabase: Supabase, userId: string, name: unknown, rawArguments: unknown): Promise<ToolActivity> {
  if (name !== "search_partners" && name !== "list_categories") throw new Error("Ferramenta não permitida.");
  if (!isRecord(rawArguments)) throw new Error("Argumentos de ferramenta inválidos.");

  if (name === "search_partners") {
    const query = sanitizeSearchQuery(rawArguments.query);
    if (!query) throw new Error("A busca de sócios exige um texto válido.");
    const { data, error } = await supabase
      .from("partners")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(10);
    if (error) throw new Error("Não foi possível consultar sócios.");
    const candidates = (data || []).map((row) => ({ id: row.id, name: row.name }));
    return { tool: "search_partners", label: "Consultei sócios ativos", result: { count: candidates.length, candidates } };
  }

  if (Object.keys(rawArguments).length > 0) throw new Error("list_categories não aceita argumentos.");
  const { data: programs, error } = await supabase
    .from("outgoing_programs")
    .select("name, kind")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("kind", ["cost", "expense"])
    .order("name");
  if (error) throw new Error("Não foi possível consultar categorias.");
  const costCategories = unique((programs || []).filter((row) => row.kind === "cost").map((row) => row.name));
  const expenseCategories = unique((programs || []).filter((row) => row.kind === "expense").map((row) => row.name));
  return {
    tool: "list_categories",
    label: "Consultei categorias ativas",
    result: { count: costCategories.length + expenseCategories.length, costCategories, expenseCategories },
  };
}
