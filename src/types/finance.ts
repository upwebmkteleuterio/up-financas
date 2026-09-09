export type TransactionType = "Entrada" | "Saída";
export type PaymentMethod = "Pix" | "Parcelado" | "Dinheiro" | "Cartão" | "Transferência";
export type AccountType = "main" | "reserve";
export type CostType = "Fixo" | "Variável";
export type ContractType = "Parcelado" | "Fixo" | "Recorrente";
export type MarketingCategory = "Meta Ads" | "Google Ads" | "Tiktok Ads" | "Plataforma Freelancer" | "Outros";

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
  sourceContractId?: string; // ID do contrato de origem
  accountType?: AccountType; // main ou reserve
  isTransfer?: boolean; // identifica se é transferência entre contas
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