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
  drafts?: TransactionDraft[];
  draft?: TransactionDraft;
  operationId?: string;
  confirmed?: boolean;
  diagnostics?: boolean;
};

export type MissingByItem = {
  index: number;
  label: string;
  missingFields: string[];
};

export type FinanceContext = {
  activeCostCategories: string[];
  expenseCategories: string[];
  entryCategories: string[];
  activePartners: Array<{ id: string; name: string }>;
  currentDate: string;
  currentYear: number;
  currentMonth: number;
  timezone: "America/Sao_Paulo";
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
  kind: "message" | "proposal" | "missing";
  message?: string;
  missingFields?: string[];
  missingByItem?: MissingByItem[];
  categoryOptions?: string[];
  drafts?: TransactionDraft[];
};

export type ModelToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ModelMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; reasoning_content?: string | null; tool_calls?: ModelToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type DiagnosticStageName = "context" | "model_request" | "follow_up" | "tool_execution" | "validation" | "response";
export type DiagnosticStatus = "ok" | "error" | "skipped";
export type DiagnosticsState = {
  enabled: boolean;
  stages: Array<{ stage: DiagnosticStageName; status: DiagnosticStatus; code: string; durationMs: number }>;
};

export type Supabase = SupabaseClient;
