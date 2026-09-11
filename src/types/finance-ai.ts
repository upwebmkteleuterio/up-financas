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
  activities?: AiToolActivity[];
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

export interface AiChatResponse {
  kind: "message" | "proposal" | "missing" | "error";
  message: string;
  missingFields?: string[];
  categoryOptions?: string[];
  draft?: AiTransactionDraft;
  transactionId?: string;
  activities?: AiToolActivity[];
}
