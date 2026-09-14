import type { AccountType, PaymentMethod, TransactionType } from "@/types/finance";

export type AiDraftSubgroup = "Entrada" | "Custo" | "Gasto" | "Saque" | "Fundo";

export interface AiTransactionDraft {
  type: TransactionType;
  category: string;
  description: string;
  value: number;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  partnerId?: string;
  partnerName?: string;
  accountType: AccountType;
  isTransfer: boolean;
  subgroup: AiDraftSubgroup;
}

export interface AiChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  activities?: AiToolActivity[];
  diagnostics?: AiDiagnostics;
  requestId?: string;
}

export interface AiToolActivity {
  tool: "search_partners" | "list_categories";
  label: string;
  result: {
    count: number;
    candidates?: Array<{ id: string; name: string }>;
    costCategories?: string[];
    expenseCategories?: string[];
  };
}

export interface AiDiagnosticStage {
  stage: "context" | "model_request" | "follow_up" | "tool_execution" | "validation" | "response";
  status: "ok" | "error" | "skipped";
  code?: string;
  durationMs: number;
}

export interface AiDiagnostics {
  stages: AiDiagnosticStage[];
}

export interface AiMissingByItem {
  index: number;
  label: string;
  missingFields: string[];
}

export interface AiChatResponse {
  kind: "message" | "proposal" | "missing" | "error";
  message: string;
  requestId?: string;
  diagnostics?: AiDiagnostics;
  missingFields?: string[];
  missingByItem?: AiMissingByItem[];
  categoryOptions?: string[];
  draft?: AiTransactionDraft;
  drafts?: AiTransactionDraft[];
  transactionId?: string;
  transactionIds?: string[];
  createdCount?: number;
  activities?: AiToolActivity[];
}
