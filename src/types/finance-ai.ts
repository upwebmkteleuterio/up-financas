import type { AccountType, PaymentMethod, TransactionType } from "@/types/finance";

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

export interface AiChatResponse {
  kind: "message" | "proposal" | "missing" | "error";
  message: string;
  requestId?: string;
  diagnostics?: AiDiagnostics;
  missingFields?: string[];
  categoryOptions?: string[];
  draft?: AiTransactionDraft;
  transactionId?: string;
  activities?: AiToolActivity[];
}
