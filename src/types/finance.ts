export type TransactionType = "Entrada" | "Saída";
export type PaymentMethod = "Pix" | "Parcelado" | "Dinheiro" | "Cartão" | "Transferência";
export type AccountType = "main" | "reserve";
export type CostType = "Fixo" | "Variável";
export type ContractType = "Parcelado" | "Fixo" | "Recorrente";
export type MarketingCategory = "Meta Ads" | "Google Ads" | "Tiktok Ads" | "Plataforma Freelancer" | "Outros";
export type OutgoingKind = "cost" | "expense" | "profit" | "cash_reserve";
export type OutgoingFrequency = "none" | "once" | "count" | "monthly";
export type OutgoingStatus = "pending" | "paid" | "partial";

export interface OutgoingProgram {
  id: string;
  userId: string;
  kind: OutgoingKind;
  name: string;
  description?: string | null;
  value?: number | null;
  costType?: CostType | null;
  frequency: OutgoingFrequency;
  startDate?: string | null;
  dueDay?: number | null;
  repeatCount?: number | null;
  partnerId?: string | null;
  isActive: boolean;
  legacyCostCategoryId?: string | null;
  legacyExpenseCategoryId?: string | null;
  historicalNames?: string[] | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OutgoingOccurrence {
  id?: string;
  userId?: string;
  programId: string;
  sequenceNumber: number | null;
  dueDate: string;
  scheduledValue: number;
  status: OutgoingStatus;
  actualValue?: number | null;
  actualDate?: string | null;
  transactionId?: string | null;
  isResidual: boolean;
  parentOccurrenceId?: string | null;
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

export interface CashReserveEntity {
  id: string;
  name: string;
  targetValue: number;
  userId: string;
}

export interface AccountBalance {
  id: string;
  userId: string;
  accountType: AccountType;
  balance: number;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  description: string;
  value: number;
  date: string; // ISO date string
  paymentMethod: PaymentMethod;
  notes?: string;
  partnerId?: string;
  isAutomated?: boolean; // Novo campo para identificar transações automáticas
  createdSource?: "manual" | "ai" | "pdf" | "system";
  operationId?: string;
  sourceContractId?: string; // ID do contrato de origem
  accountType?: AccountType; // main ou reserve
  isTransfer?: boolean; // identifica se é transferência entre contas
  transferGroupId?: string;
  pdfExternalId?: string;
  importBatchId?: string;
  importSource?: string;
  importFileName?: string;
  importedAt?: string;
  rawText?: string;
}

export interface ContractInstallment {
  id: string;
  value: number;
  dueDate: string; // ISO date string
  isPaid: boolean;
  paidValue?: number;
  paidDate?: string;
  originalValue?: number; // valor original da parcela antes de um recebimento parcial
}

export interface Contract {
  id: string;
  clientName: string;
  service: string;
  phone: string;
  notes?: string;
  
  // Dados do Contrato
  contractType: ContractType;
  totalContractValue: number; // Valor total do contrato (soma de todas as parcelas/recorrências)
  dateClosed: string; // Data em que o contrato foi fechado (NOVO)
  
  // Automação
  launchFinancialEntry: boolean; // Lançar entrada financeira automaticamente?
  
  // Detalhes da Recorrência/Parcelamento
  installments: ContractInstallment[];
  
  // Campos específicos para Recorrente
  isRecurrenceValueFixed?: boolean; // Apenas para Recorrente: O valor das parcelas é fixo?
  
  // NOVO: Status de Cancelamento
  isCanceled: boolean;
}

export interface AssociatedSale {
    id: string;
    clientName: string;
    saleValue: number;
    dateClosed: string; // NOVO: Data de fechamento da venda
    contractId?: string; // NOVO: ID do contrato se já foi lançado
}

export interface MarketingInvestment {
    id: string;
    name: string;
    category: MarketingCategory;
    date: string; // ISO date string
    investmentValue: number;
    leads?: number;
    associatedSales: AssociatedSale[];
}

export interface CostCategory {
  id: string;
  name: string;
  type: CostType;
  dueDate?: string; // ISO date string (apenas para Fixo)
  value?: number; // Apenas para Fixo
  description?: string;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isActive?: boolean;
}

export interface ServiceCategory {
  id: string;
  name: string;
}

// Subcategorias para o novo campo condicional
export const subcategories = {
  Entrada: ["Vendas", "Saque Kiwify", "Fundo de Caixa", "Outras Entradas"],
  Saida: {
    // Estas são as categorias fixas que não são gerenciadas pelo painel de custos/gastos
    Fixed: ["Saque de Lucro", "Fundo de Caixa"],
  },
  Reserve: {
    Entrada: ["Aporte Fundo", "Rendimento", "Outros"],
    Saida: ["Resgate Fundo", "Custo Operacional", "Outros"]
  }
};

export const marketingCategories: MarketingCategory[] = [
    "Meta Ads", 
    "Google Ads", 
    "Tiktok Ads", 
    "Plataforma Freelancer", 
    "Outros"
];