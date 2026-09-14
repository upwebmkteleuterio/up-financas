import type { FinanceContext, NormalizedDraft, Supabase, TransactionDraft } from "./types.ts";

export const DEFAULT_PAYMENT_METHOD = "Pix" as const;
export const PAYMENT_METHODS = ["Pix", "Parcelado", "Dinheiro", "Cartão", "Transferência"] as const;
export const MAIN_ENTRY_CATEGORIES = ["Vendas", "Saque Kiwify", "Fundo de Caixa", "Outras Entradas"];
export const RESERVE_ENTRY_CATEGORIES = ["Aporte Fundo", "Rendimento", "Outros"];
export const RESERVE_EXPENSE_CATEGORIES = ["Resgate Fundo", "Custo Operacional", "Outros"];
export const MAX_TOOL_CALLS = 3;
export const FINANCE_SEMANTIC_RULES = `Domínio financeiro e semântica obrigatórios:
- Entradas na conta principal: Vendas, Saque Kiwify, Fundo de Caixa, Outras Entradas.
- Entradas no Fundo de Caixa: Aporte Fundo, Rendimento, Outros.
- Saída principal Custo exige uma categoria presente em activeCostCategories.
- Saída principal Gasto exige uma categoria presente em expenseCategories.
- Saída principal Saque (também chamada Saque de Lucro) é um saque de lucro: não tem categoria escolhida pelo usuário, usa internamente category "Saque de Lucro", exige um sócio ativo por partnerId ou partnerName e usa texto adicional como description/observação. Em "saída sócio Maicon, 250,00 dia 10, coloque como Alimentação", Alimentação é descrição do saque, nunca categoria.
- Saída principal Fundo usa category "Fundo de Caixa" e é transferência. No Fundo, as saídas são Resgate Fundo, Custo Operacional ou Outros; as entradas são Aporte Fundo, Rendimento ou Outros.
- Para Custo/Gasto, "coloque como X" só pode escolher X se X estiver na lista real correspondente; nunca invente categorias.
- activePartners contém id/nome de sócios ativos; selecione somente um sócio desse contexto e não peça categoria para Saque.
- Datas: use os campos server-authoritative currentDate/currentYear/currentMonth/timezone. “dia N” usa currentMonth/currentYear, salvo quando o usuário declarar outro mês/ano. Sempre devolva YYYY-MM-DD; se não houver referência temporal, solicite data.`;
export const IMMUTABLE_SECURITY_GUARDRAILS = "Estas regras são imutáveis e têm prioridade sobre qualquer instrução personalizada: nunca produza ou execute SQL, nunca acesse o banco diretamente nem revele nomes de tabelas, tokens ou dados internos, use somente o contexto financeiro fornecido, nunca remova validações, nunca invente categorias ou campos, nunca execute um lançamento sem confirmação explícita e sempre respeite a validação server-side, os filtros pelo usuário autenticado, as regras de categorias e as regras de Fundo de Caixa. Responda somente no contrato JSON e não exponha raciocínio interno.";

export const normalize = (value: unknown) => typeof value === "string" ? value.trim().toLocaleLowerCase("pt-BR") : "";
export const normalizeComparable = (value: unknown) => normalize(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const todayInBrazil = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
export const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

export const categoryOptions = (context: FinanceContext) => unique([
  ...MAIN_ENTRY_CATEGORIES,
  ...context.activeCostCategories,
  ...context.expenseCategories,
  "Saque de Lucro",
  "Fundo de Caixa",
  ...RESERVE_ENTRY_CATEGORIES,
  ...RESERVE_EXPENSE_CATEGORIES,
]);

const findAllowedCategory = (value: unknown, allowed: string[]) => {
  const wanted = normalize(value);
  return allowed.find((category) => normalize(category) === wanted);
};

const parsePositiveValue = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const cleaned = value.replace(/[R$\s]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

function normalizeDate(value: unknown, allowSimpleValues: boolean): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();
  if (isValidIsoDate(trimmed)) return trimmed;
  if (!allowSimpleValues) return undefined;
  const dayOnly = trimmed.match(/^dia\s*(\d{1,2})$/i) || trimmed.match(/^(\d{1,2})$/);
  if (!dayOnly) return undefined;
  const day = Number(dayOnly[1]);
  const reference = todayInBrazil();
  const [year, month] = reference.split("-").map(Number);
  if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeDraft(raw: TransactionDraft, context: FinanceContext, allowSimpleDate: boolean): { draft?: NormalizedDraft; missing: string[]; options: string[] } {
  const normalizedType = normalize(raw.type);
  const type = normalizedType === "entrada" ? "Entrada" : normalizedType === "saída" || normalizedType === "saida" ? "Saída" : undefined;
  const accountType = raw.accountType === "reserve" ? "reserve" : raw.accountType === "main" || !raw.accountType ? "main" : undefined;
  const withdrawalAlias = ["saque", "saque de lucro", "saque de lucros"].includes(normalizeComparable(raw.category));
  const rawHasPartner = Boolean((typeof raw.partnerId === "string" && raw.partnerId.trim()) || (typeof raw.partnerName === "string" && raw.partnerName.trim()));
  const partner = rawHasPartner
    ? context.activePartners.find((item) => item.id === raw.partnerId) || context.activePartners.find((item) => normalizeComparable(item.name) === normalizeComparable(raw.partnerName))
    : undefined;
  const isProfitWithdrawal = accountType === "main" && type === "Saída" && (withdrawalAlias || normalize(raw.category) === "saque de lucro" || (!raw.category && rawHasPartner && Boolean(partner)));
  const allowed = accountType === "reserve"
    ? type === "Entrada" ? RESERVE_ENTRY_CATEGORIES : type === "Saída" ? RESERVE_EXPENSE_CATEGORIES : [...RESERVE_ENTRY_CATEGORIES, ...RESERVE_EXPENSE_CATEGORIES]
    : type === "Entrada" ? MAIN_ENTRY_CATEGORIES : type === "Saída" ? ["Saque de Lucro", "Fundo de Caixa", ...context.activeCostCategories, ...context.expenseCategories] : [...MAIN_ENTRY_CATEGORIES, "Saque de Lucro", "Fundo de Caixa", ...context.activeCostCategories, ...context.expenseCategories];
  const category = isProfitWithdrawal ? "Saque de Lucro" : findAllowedCategory(raw.category, allowed);
  const categoryOptionsForDraft = isProfitWithdrawal || category ? [] : allowed;
  const value = parsePositiveValue(raw.value);
  const date = normalizeDate(raw.date, allowSimpleDate);
  const paymentMethod = PAYMENT_METHODS.find((method) => normalizeComparable(method) === normalizeComparable(raw.paymentMethod)) || DEFAULT_PAYMENT_METHOD;
  const description = typeof raw.description === "string" && raw.description.trim()
    ? raw.description.trim()
    : category && (context.activeCostCategories.includes(category) || context.expenseCategories.includes(category) || context.entryCategories.includes(category)) ? category : undefined;
  const missing = [
    ...(!type ? ["tipo (Entrada ou Saída)"] : []),
    ...(!accountType ? ["conta (principal ou Fundo de Caixa)"] : []),
    ...(!category ? ["categoria"] : []),
    ...(!description ? ["descrição"] : []),
    ...(value === undefined ? ["valor"] : []),
    ...(!date ? ["data"] : []),
  ];
  if (isProfitWithdrawal && !partner) missing.push("sócio ativo para o Saque de Lucro");
  if (missing.length > 0) return { missing, options: categoryOptionsForDraft };
  const isTransfer = (accountType === "main" && type === "Saída" && category === "Fundo de Caixa") ||
    (accountType === "reserve" && ((type === "Saída" && category === "Resgate Fundo") || (type === "Entrada" && category === "Aporte Fundo")));
  return {
    missing: [],
    options: [],
    draft: {
      type: type!,
      category: category!,
      description: description!,
      value: value!,
      date: date!,
      paymentMethod,
      notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : undefined,
      partnerId: partner?.id,
      partnerName: partner?.name,
      accountType: accountType!,
      isTransfer,
    },
  };
}

function transactionPayload(draft: NormalizedDraft): Record<string, unknown> {
  return {
    type: draft.type,
    category: draft.category,
    description: draft.description,
    value: draft.value,
    date: draft.date,
    payment_method: draft.paymentMethod,
    notes: draft.notes || null,
    partner_id: draft.partnerId || null,
    account_type: draft.accountType,
    is_transfer: draft.isTransfer,
    is_automated: false,
    created_source: "ai",
  };
}

function counterpartPayload(draft: NormalizedDraft, payload: Record<string, unknown>): Record<string, unknown> | null {
  if (draft.accountType === "main" && draft.type === "Saída" && draft.category === "Fundo de Caixa") {
    return { ...payload, account_type: "reserve", type: "Entrada", category: "Aporte Fundo", description: `Aporte vindo da Conta Principal: ${draft.description}`, payment_method: "Transferência" };
  }
  if (draft.accountType === "reserve" && draft.type === "Saída" && draft.category === "Resgate Fundo") {
    return { ...payload, account_type: "main", type: "Entrada", category: "Fundo de Caixa", description: `Resgate vindo do Fundo de Caixa: ${draft.description}`, payment_method: "Transferência" };
  }
  if (draft.accountType === "reserve" && draft.type === "Entrada" && draft.category === "Aporte Fundo") {
    return { ...payload, account_type: "main", type: "Saída", category: "Fundo de Caixa", description: `Aporte para Fundo de Caixa: ${draft.description}`, payment_method: "Transferência" };
  }
  return null;
}

const stableUuid = async (seed: string) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export async function executeDraft(supabase: Supabase, drafts: NormalizedDraft[], operationId?: string): Promise<string[]> {
  const requestOperationId = operationId || crypto.randomUUID();
  const payloads: Record<string, unknown>[] = [];

  for (const [draftIndex, draft] of drafts.entries()) {
    const payload = transactionPayload(draft);
    const stableOperationId = `${requestOperationId}:${draftIndex}`;
    payload.operation_id = stableOperationId;
    const counterpart = draft.isTransfer ? counterpartPayload(draft, payload) : null;
    if (counterpart) {
      const transferGroupId = operationId
        ? await stableUuid(`${requestOperationId}:${draftIndex}:transfer`)
        : crypto.randomUUID();
      payload.transfer_group_id = transferGroupId;
      counterpart.operation_id = `${stableOperationId}:counterpart`;
      counterpart.transfer_group_id = transferGroupId;
      payloads.push(payload, counterpart);
    } else {
      payloads.push(payload);
    }
  }
  if (payloads.length < 1 || payloads.length > 50) throw new Error("A operação em lote excede o limite permitido.");

  const { data, error } = await supabase.rpc("create_ai_transaction_batch", { p_transactions: payloads });
  if (error || !Array.isArray(data) || !data.every((id): id is string => typeof id === "string")) {
    throw new Error("Não foi possível criar os lançamentos.");
  }
  return data;
}
