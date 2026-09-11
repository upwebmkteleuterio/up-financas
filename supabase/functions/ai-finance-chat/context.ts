import type { FinanceContext, Supabase } from "./types.ts";
import {
  DEFAULT_PAYMENT_METHOD,
  MAIN_ENTRY_CATEGORIES,
  RESERVE_ENTRY_CATEGORIES,
  RESERVE_EXPENSE_CATEGORIES,
  unique,
} from "./finance-domain.ts";

export async function loadCustomSystemPrompt(supabase: Supabase, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("finance_ai_settings")
    .select("system_prompt")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a instrução personalizada.");
  return typeof data?.system_prompt === "string" && data.system_prompt.trim() ? data.system_prompt.trim() : null;
}

export async function loadContext(supabase: Supabase, userId: string): Promise<FinanceContext> {
  const timezone = "America/Sao_Paulo" as const;
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const currentYear = Number(dateParts.year);
  const currentMonth = Number(dateParts.month);
  const currentDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const [costs, expenses, partners] = await Promise.all([
    supabase.from("cost_categories").select("name").eq("user_id", userId).eq("is_active", true),
    // expense_categories predates an is_active column; every row is an available category.
    supabase.from("expense_categories").select("name").eq("user_id", userId),
    supabase.from("partners").select("id, name").eq("user_id", userId).eq("is_active", true),
  ]);
  const failure = [costs, expenses, partners].find((result) => result.error);
  if (failure?.error) throw new Error("Não foi possível carregar as opções financeiras.");
  return {
    activeCostCategories: unique((costs.data || []).map((row) => row.name)),
    expenseCategories: unique((expenses.data || []).map((row) => row.name)),
    entryCategories: unique([...MAIN_ENTRY_CATEGORIES, ...RESERVE_ENTRY_CATEGORIES]),
    activePartners: (partners.data || []).map((row) => ({ id: row.id, name: row.name })),
    currentDate,
    currentYear,
    currentMonth,
    timezone,
    rules: {
      type: ["Entrada", "Saída"],
      paymentMethodDefault: DEFAULT_PAYMENT_METHOD,
      mainEntryCategories: MAIN_ENTRY_CATEGORIES,
      reserveEntryCategories: RESERVE_ENTRY_CATEGORIES,
      reserveExpenseCategories: RESERVE_EXPENSE_CATEGORIES,
      profitWithdrawalRequiresPartner: true,
      cashReserveUsesTransferCounterpart: true,
      noTransactionBeforeConfirmation: true,
    },
  };
}
