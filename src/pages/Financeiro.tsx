import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFinance, useInfiniteTransactions } from "@/hooks/use-finance";
import { Transaction, TransactionType } from "@/types/finance";
import { cn, createLocalDateFromISO } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { TRANSACTION_CREATED_EVENT, type TransactionCreatedDetail } from "@/lib/transaction-events";
import { ArrowDown, ArrowUp, DollarSign, Trash2, Pencil, Loader2, Plus, Wallet, FileText } from "lucide-react";
import TransactionFormDialog from "@/components/TransactionFormDialog";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import { showSuccess } from "@/utils/toast";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import { isWithinInterval, parseISO, format } from "date-fns";
import TransactionIcon from "@/components/TransactionIcon";
import { usePartners } from "@/hooks/usePartners";
import { useCosts } from "@/hooks/useCosts";
import HiddenValue from "@/components/HiddenValue";
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility";
import FloatingActionButton from "@/components/FloatingActionButton";
import { useIsMobile } from "@/hooks/use-mobile";
import TransactionSkeleton from "@/components/TransactionSkeleton";
import DashboardSummaryCard from "@/components/DashboardSummaryCard";
import NotesTooltip from "@/components/NotesTooltip";
import TransactionListActionsMenu from "@/components/TransactionListActionsMenu";
import { Link } from "react-router-dom";

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Componente para o Card de Resumo
interface SummaryCardProps {
  title: string;
  value: number;
  colorClass: string;
  icon: React.ReactNode;
  chartData: { name: string; value: number }[];
  gradientId: string; 
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  colorClass,
  icon,
  chartData,
  gradientId, 
}) => (
  <DashboardSummaryCard
    title={title}
    value={value}
    icon={icon}
    colorClass={colorClass}
    isCurrency={true}
    formatCurrency={formatCurrency}
    chartData={chartData}
    gradientId={gradientId} 
  />
);

// Componente para a Faixa Total em Conta
interface TotalInAccountStripProps {
    value: number;
    fundoCaixa: number;
    totalConsolidado: number;
}

const TotalInAccountStrip: React.FC<TotalInAccountStripProps> = ({ value, fundoCaixa, totalConsolidado }) => (
    <Card className="bg-card border-border shadow-xl rounded-[1rem]">
        <CardContent className="p-5 space-y-4"> 
            <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm font-medium"> 
                    Total em Conta
                </span>
                <HiddenValue
                    value={value}
                    formatFn={formatCurrency}
                    className="text-2xl font-bold text-green-400" 
                />
            </div>
            
            <Separator className="bg-border/50" />
            
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 flex items-center">
                        <Wallet className="w-3 h-3 mr-1" /> Fundo de Caixa
                    </span>
                    <HiddenValue
                        value={fundoCaixa}
                        formatFn={formatCurrency}
                        className="text-lg font-semibold text-blue-400" 
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                        Conta + Fundo
                    </span>
                    <HiddenValue
                        value={totalConsolidado}
                        formatFn={formatCurrency}
                        className="text-lg font-semibold text-white/90" 
                    />
                </div>
            </div>
        </CardContent>
    </Card>
);

// Componente para a Linha de Transação
interface TransactionItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
  onEdit: (updatedTransaction: Transaction) => void;
  getPartnerNameById: (id: string) => string | undefined;
  isHighlighted: boolean;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onDelete, onEdit, getPartnerNameById, isHighlighted }) => {
  const isEntry = transaction.type === "Entrada";
  const isSaqueLucro = transaction.category === "Saque de Lucro";
  const isFundoCaixa = transaction.category === "Fundo de Caixa" || transaction.isTransfer;
  
  let valueClass = isEntry ? "text-green-500" : "text-red-500";
  if (isSaqueLucro) {
    valueClass = "text-purple-500";
  } else if (isFundoCaixa) {
    valueClass = "text-blue-400"; // Cor diferente para transferências/fundo
  }
  
  const sign = isEntry ? "+" : "-";
  
  let mainText: string;
  let secondaryText: string;

  if (isEntry) {
    mainText = transaction.description;
    secondaryText = `${transaction.category} • ${transaction.paymentMethod}`;
  } else if (isSaqueLucro) {
    const partnerName = getPartnerNameById(transaction.partnerId || "");
    
    const fullDescription = transaction.description;
    const detailedDescription = partnerName && fullDescription.startsWith(partnerName)
        ? fullDescription.substring(partnerName.length + 3).trim()
        : fullDescription;
        
    mainText = `${partnerName || "Sócio Desconhecido"} - ${transaction.category}`;
    secondaryText = detailedDescription;
    
  } else if (isFundoCaixa) {
    mainText = transaction.category;
    secondaryText = transaction.description;
  } else {
    mainText = transaction.category;
    secondaryText = transaction.description;
  }

  return (
    <NotesTooltip notes={transaction.notes || ""}>
        <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors group", isHighlighted && "transaction-created-highlight")}>
          
          <div className="flex items-center space-x-4 flex-1 min-w-0 w-full md:w-auto">
            <TransactionIcon
              type={transaction.type}
              customColor={isSaqueLucro ? "purple" : isFundoCaixa ? "blue" : undefined}
            />
            
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-sidebar-primary-foreground truncate">
                {mainText}
              </span>
              <span className="text-xs text-gray-400 mt-1 truncate">
                {secondaryText}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center w-full md:w-auto md:ml-4 mt-3 md:mt-0 flex-shrink-0">
            <div className="flex flex-col items-start md:items-end">
              <HiddenValue
                value={transaction.value}
                formatFn={(v) => `${sign} ${formatCurrency(v)}`}
                className={cn("font-bold whitespace-nowrap text-lg", valueClass)}
              />
              <span className="text-xs text-gray-400 mt-1 whitespace-nowrap">
                {format(createLocalDateFromISO(transaction.date), "dd/MM/yyyy")}
              </span>
            </div>

            <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-4">
                <TransactionListActionsMenu
                    transaction={transaction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            </div>
          </div>
        </div>
    </NotesTooltip>
  );
};

const mockChartDataUp = [
    { name: 'D1', value: 100 }, { name: 'D2', value: 150 }, { name: 'D3', value: 120 }, { name: 'D4', value: 200 }, { name: 'D5', value: 180 }, { name: 'D6', value: 250 }, { name: 'D7', value: 220 },
];

const mockChartDataDown = [
    { name: 'D1', value: 250 }, { name: 'D2', value: 150 }, { name: 'D3', value: 200 }, { name: 'D4', value: 100 }, { name: 'D5', value: 180 }, { name: 'D6', value: 120 }, { name: 'D7', value: 80 },
];

const Financeiro = () => {
  const { addTransaction, updateTransaction, deleteTransaction, useFilteredTransactionsSummary } = useFinance();
  const { getPartnerNameById } = usePartners();
  const { costCategories } = useCosts();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"Todos" | TransactionType | "Saque de Lucro" | "Fundo de Caixa">("Todos");
  const [dateFilter, setDateFilter] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  
  const costCategoryNames = useMemo(() => costCategories.map(c => c.name), [costCategories]);

  const { transactions: dateFilteredTransactions, isLoading: isLoadingInfinite, hasMore, loadMore, isFetching } = useInfiniteTransactions(dateFilter, customDateRange, costCategoryNames, "main");
  const { summary } = useFilteredTransactionsSummary(dateFilter, customDateRange, "main");
  
  const handleAddTransaction = useCallback(async (data: Omit<Transaction, "id">) => {
    await addTransaction(data);
  }, [addTransaction]);

  const filteredTransactions = useMemo(() => {
    let list = dateFilteredTransactions;
    if (activeTab === "Entrada") list = list.filter((t) => t.type === "Entrada" && t.category !== "Fundo de Caixa");
    else if (activeTab === "Saída") list = list.filter((t) => t.type === "Saída" && t.category !== "Saque de Lucro" && t.category !== "Fundo de Caixa");
    else if (activeTab === "Saque de Lucro") list = list.filter((t) => t.category === "Saque de Lucro");
    else if (activeTab === "Fundo de Caixa") list = list.filter((t) => t.category === "Fundo de Caixa" || t.isTransfer);
    return list;
  }, [dateFilteredTransactions, activeTab]);
  
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    filteredTransactions.forEach(t => {
        const dateKey = format(createLocalDateFromISO(t.date), "dd/MM/yyyy");
        if (!groups.has(dateKey)) groups.set(dateKey, []);
        groups.get(dateKey)!.push(t);
    });
    return Array.from(groups.entries()).map(([date, transactions]) => ({ date, transactions }));
  }, [filteredTransactions]);

  // --- Lógica para mostrar FAB no Desktop ao rolar ---
  const [showFAB, setShowFAB] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Quando o cabeçalho sair da tela (isIntersecting: false), mostramos o FAB
        setShowFAB(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleTransactionCreated = (event: Event) => {
      const detail = (event as CustomEvent<TransactionCreatedDetail>).detail;
      if (!detail || typeof detail.id !== "string") return;

      setHighlightedTransactionId(detail.id);
      if (highlightTimeoutRef.current !== null) window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedTransactionId(null);
        highlightTimeoutRef.current = null;
      }, 4000);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    };

    window.addEventListener(TRANSACTION_CREATED_EVENT, handleTransactionCreated);
    return () => {
      window.removeEventListener(TRANSACTION_CREATED_EVENT, handleTransactionCreated);
      if (highlightTimeoutRef.current !== null) window.clearTimeout(highlightTimeoutRef.current);
    };
  }, [queryClient]);

  const fabSaidaTrigger = (
    <FloatingActionButton 
        icon={<ArrowDown className="w-6 h-6" />} 
        onClick={() => {}} 
        colorClass="bg-red-600 hover:bg-red-700" 
        size="fab-lg" 
        className="bottom-6 right-6" 
    />
  );
  
  const fabEntradaTrigger = (
    <FloatingActionButton 
        icon={<ArrowUp className="w-5 h-5" />} 
        onClick={() => {}} 
        colorClass="bg-green-600 hover:bg-green-700" 
        size="fab-sm" 
        className="bottom-24 right-6" 
    />
  );

  return (
    <Layout pageTitle="Financeiro" pageSubtitle="Controle completo de entradas e saídas">
      <div className="space-y-6">
        {/* Header e Botões de Lançamento */}
        <div 
          ref={headerRef}
          className="hidden lg:flex justify-between items-center lg:py-6 lg:mb-2"
        >
          <div>
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">Financeiro</h1>
            <p className="text-gray-400 mt-1">Controle completo de entradas e saídas</p>
          </div>
          <div className="flex space-x-3 items-center">
            <VisibilityToggleButton />
            <Button asChild variant="outline"><Link to="/financeiro/importar-pdf"><FileText className="w-4 h-4 mr-2" />Importar PDF</Link></Button>
            <TransactionFormDialog onSubmit={handleAddTransaction} defaultType="Saída" trigger={<Button className="bg-red-600 hover:bg-red-700 text-white"><ArrowDown className="w-4 h-4 mr-2" />Nova Saída</Button>} />
            <TransactionFormDialog onSubmit={handleAddTransaction} defaultType="Entrada" trigger={<Button className="bg-green-600 hover:bg-green-700 text-white"><ArrowUp className="w-4 h-4 mr-2" />Nova Entrada</Button>} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard title="Total de Entradas" value={summary.totalEntradas} colorClass="text-green-500" icon={<ArrowUp className="w-4 h-4 text-green-500" />} chartData={mockChartDataUp} gradientId="gradEntradas" />
          <SummaryCard title="Total de Saques de Lucro" value={summary.totalSaquesLucro} colorClass="text-purple-500" icon={<DollarSign className="w-4 h-4 text-purple-500" />} chartData={mockChartDataUp} gradientId="gradSaques" />
          <SummaryCard title="Total de Custos" value={summary.totalCustos} colorClass="text-yellow-500" icon={<DollarSign className="w-4 h-4 text-yellow-500" />} chartData={mockChartDataDown} gradientId="gradCustos" />
          <SummaryCard title="Total de Gastos" value={summary.totalGastos} colorClass="text-red-500" icon={<ArrowDown className="w-4 h-4 text-red-500" />} chartData={mockChartDataDown} gradientId="gradGastos" />
        </div>

        <TotalInAccountStrip 
            value={summary.totalEmConta} 
            fundoCaixa={summary.totalFundoCaixa}
            totalConsolidado={summary.totalContaComFundo}
        />

        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader className="p-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <TabsList className="bg-sidebar-accent/50">
                  <TabsTrigger value="Todos">Todos</TabsTrigger>
                  <TabsTrigger value="Entrada">Entradas</TabsTrigger>
                  <TabsTrigger value="Saída">Saídas</TabsTrigger>
                  <TabsTrigger value="Saque de Lucro">Saque de Lucro</TabsTrigger>
                  <TabsTrigger value="Fundo de Caixa">Fundo de Caixa</TabsTrigger>
                </TabsList>
                <FilterDropdown
                  activeFilter={dateFilter}
                  setActiveFilter={setDateFilter}
                  customDateRange={customDateRange}
                  setCustomDateRange={setCustomDateRange}
                  allowedFilters={[
                    "month_0", "month_1", "month_2", "month_3", "month_4", "month_5",
                    "month_6", "month_7", "month_8", "month_9", "month_10", "month_11",
                    "custom"
                  ]}
                />
              </div>
              <Separator className="my-4 bg-sidebar-border" />
              
              <TabsContent value={activeTab} className="mt-0">
                <div className="space-y-1">
                  {(isLoadingInfinite && filteredTransactions.length === 0) ? (
                    <div className="space-y-1">{Array.from({ length: 5 }).map((_, index) => <TransactionSkeleton key={index} />)}</div>
                  ) : groupedTransactions.length > 0 ? (
                    <>
                      {groupedTransactions.map((group) => (
                        <React.Fragment key={group.date}>
                            <div className="px-4 py-2 bg-transparent text-sm font-semibold sticky top-[100px] lg:top-[76px] z-10 border-b border-border" style={{ color: '#52667a' }}>{group.date}</div>
                            {group.transactions.map((t) => <TransactionItem key={t.id} transaction={t} onDelete={deleteTransaction} onEdit={updateTransaction} getPartnerNameById={getPartnerNameById} isHighlighted={t.id === highlightedTransactionId} />)}
                        </React.Fragment>
                      ))}
                      {hasMore && (
                          <div className="p-4 text-center">
                              <Button variant="outline" onClick={() => loadMore()} disabled={isFetching} className="bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent">
                                {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Carregar Mais Transações"}
                              </Button>
                          </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-gray-500 p-8">Nenhuma transação encontrada.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
      
      {/* FABs: Visíveis no Mobile OU no Desktop quando o usuário rola para baixo */}
      {(isMobile || showFAB) && (
        <>
            <TransactionFormDialog onSubmit={handleAddTransaction} defaultType="Entrada" trigger={fabEntradaTrigger} />
            <TransactionFormDialog onSubmit={handleAddTransaction} defaultType="Saída" trigger={fabSaidaTrigger} />
        </>
      )}
    </Layout>
  );
};

export default Financeiro;