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
  role: "user" | "assistant";
  content: string;
}

export interface AiChatResponse {
  kind: "message" | "draft" | "error";
  message: string;
  missingFields?: string[];
  categoryOptions?: string[];
  draft?: AiTransactionDraft;
}
