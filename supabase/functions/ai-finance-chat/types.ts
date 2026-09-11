import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type TransactionDraft = {
  type?: string;
  category?: string;
  description?: string;
  value?: number;
  date?: string;
  paymentMethod?: string;
  notes?: string;
  partnerId?: string;
  partnerName?: string;
  accountType?: string;
  isTransfer?: boolean;
};

export type NormalizedDraft = {
  type: "Entrada" | "Saída";
  category: string;
  description: string;
  value: number;
  date: string;
  paymentMethod: string;
  notes?: string;
  partnerId?: string;
  partnerName?: string;
  accountType: "main" | "reserve";
  isTransfer: boolean;
};

export type ChatRequest = {
  mode?: "chat" | "execute";
  message?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  draft?: TransactionDraft;
  confirmed?: boolean;
};

export type FinanceContext = {
  activeCostCategories: string[];
  expenseCategories: string[];
  entryCategories: string[];
  activePartners: Array<{ id: string; name: string }>;
  rules: Record<string, unknown>;
};

export type ToolActivity = {
  tool: "search_partners" | "list_categories";
  label: string;
  result: {
    count: number;
    candidates?: Array<{ id: string; name: string }>;
    costCategories?: string[];
    expenseCategories?: string[];
  };
};

export type ModelResponse = {
  kind: "message" | "proposal" | "missing" | "tool_request";
  message?: string;
  missingFields?: string[];
  categoryOptions?: string[];
  draft?: TransactionDraft;
  tool?: { name?: unknown; arguments?: unknown };
};

export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
export type Supabase = SupabaseClient;
