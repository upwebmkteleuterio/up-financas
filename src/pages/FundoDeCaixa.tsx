import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFinance, useInfiniteTransactions } from "@/hooks/use-finance";
import { Transaction, TransactionType, CashReserveEntity } from "@/types/finance";
import { cn, createLocalDateFromISO } from "@/lib/utils";
import { ArrowDown, ArrowUp, DollarSign, Loader2, Plus, Wallet, Shield, MoreVertical, Pencil, Trash2, AlertTriangle, Lock } from "lucide-react";
import TransactionFormDialog from "@/components/TransactionFormDialog";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { showSuccess, showError } from "@/utils/toast";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import { format } from "date-fns";
import TransactionIcon from "@/components/TransactionIcon";
import HiddenValue from "@/components/HiddenValue";
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility";
import FloatingActionButton from "@/components/FloatingActionButton";
import { useIsMobile } from "@/hooks/use-mobile";
import TransactionSkeleton from "@/components/TransactionSkeleton";
import DashboardSummaryCard from "@/components/DashboardSummaryCard";
import NotesTooltip from "@/components/NotesTooltip";
import TransactionListActionsMenu from "@/components/TransactionListActionsMenu";
import { useReserveEntities } from "@/hooks/useReserveEntities";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const SummaryCard: React.FC<{ title: string; value: number; colorClass: string; icon: React.ReactNode; gradientId: string }> = ({
  title, value, colorClass, icon, gradientId
}) => (
  <DashboardSummaryCard
    title={title}
    value={value}
    icon={icon}
    colorClass={colorClass}
    isCurrency={true}
    formatCurrency={formatCurrency}
    chartData={[]}
    gradientId={gradientId} 
  />
);

const TotalInAccountStripReserve: React.FC<{ value: number; contaPrincipal: number; totalConsolidado: number }> = ({ value, contaPrincipal, totalConsolidado }) => (
    <Card className="bg-card border-border shadow-xl rounded-[1rem]">
        <CardContent className="p-5 space-y-4"> 
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <span className="text-gray-400 text-sm font-medium">Fundo de Caixa</span>
                </div>
                <HiddenValue
                    value={value}
                    formatFn={formatCurrency}
                    className="text-2xl font-bold text-blue-400" 
                />
            </div>
            
            <Separator className="bg-border/50" />
            
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 flex items-center">
                        <Wallet className="w-3 h-3 mr-1" /> Conta Principal
                    </span>
                    <HiddenValue
                        value={contaPrincipal}
                        formatFn={formatCurrency}
                        className="text-lg font-semibold text-gray-300" 
                    />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                        Soma Consolidada
                    </span>
                    <HiddenValue
                        value={totalConsolidado}
                        formatFn={formatCurrency}
                        className="text-lg font-semibold text-white" 
                    />
                </div>
            </div>
        </CardContent>
    </Card>
);

const TransactionItem: React.FC<{ transaction: Transaction; onDelete: (id: string) => void; onEdit: (updatedTransaction: Transaction) => void }> = ({ transaction, onDelete, onEdit }) => {
  const isEntry = transaction.type === "Entrada";
  const valueClass = isEntry ? "text-green-500" : "text-red-500";
  const sign = isEntry ? "+" : "-";

  return (
    <NotesTooltip notes={transaction.notes || ""}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors group">
          <div className="flex items-center space-x-4 flex-1 min-w-0 w-full md:w-auto">
            <TransactionIcon type={transaction.type} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-sidebar-primary-foreground truncate">{transaction.category}</span>
              <span className="text-xs text-gray-400 mt-1 truncate">{transaction.description}</span>
            </div>
          </div>
          <div className="flex justify-between items-center w-full md:w-auto md:ml-4 mt-3 md:mt-0 flex-shrink-0">
            <div className="flex flex-col items-start md:items-end">
              <HiddenValue value={transaction.value} formatFn={(v) => `${sign} ${formatCurrency(v)}`} className={cn("font-bold whitespace-nowrap text-lg", valueClass)} />
              <span className="text-xs text-gray-400 mt-1 whitespace-nowrap">{format(createLocalDateFromISO(transaction.date), "dd/MM/yyyy")}</span>
            </div>
            <div className="flex space-x-1 ml-4"><TransactionListActionsMenu transaction={transaction} onEdit={onEdit} onDelete={onDelete} /></div>
          </div>
        </div>
    </NotesTooltip>
  );
};

const EntityPanel: React.FC = () => {
    const { entities, addEntity, deleteEntity, updateEntity } = useReserveEntities();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingEntity, setEditingEntity] = useState<CashReserveEntity | null>(null);
    const [name, setName] = useState("");
    const { displayValue, numericValue, handleChange, setNumericValue } = useCurrencyInput(0);

    const totalReserved = useMemo(() => entities.reduce((sum, e) => sum + e.targetValue, 0), [entities]);

    const handleSave = () => {
        if (!name.trim()) return;
        if (editingEntity) {
            updateEntity({ ...editingEntity, name, targetValue: numericValue });
            showSuccess("Entidade atualizada!");
        } else {
            addEntity({ name, targetValue: numericValue });
            showSuccess("Entidade adicionada!");
        }
        setIsAddOpen(false);
        setEditingEntity(null);
        setName("");
        setNumericValue(0);
    };

    const handleEdit = (entity: CashReserveEntity) => {
        setEditingEntity(entity);
        setName(entity.name);
        setNumericValue(entity.targetValue);
        setIsAddOpen(true);
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-900/20">
                    <Shield className="w-4 h-4 mr-2" /> Entidades
                </Button>
            </SheetTrigger>
            <SheetContent className="bg-card text-card-foreground border-border w-[90%] sm:max-w-md overflow-y-auto flex flex-col">
                <SheetHeader>
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="w-6 h-6 text-blue-400" /> Entidades de Reserva
                    </SheetTitle>
                    <p className="text-gray-400 text-sm">Dê um propósito ao seu fundo de caixa.</p>
                </SheetHeader>

                <div className="mt-6 flex-1">
                    <Button onClick={() => { setIsAddOpen(true); setEditingEntity(null); setName(""); setNumericValue(0); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-6">
                        <Plus className="w-4 h-4 mr-2" /> Nova Entidade
                    </Button>

                    <div className="space-y-4">
                        {entities.map(entity => (
                            <div key={entity.id} className="p-4 rounded-lg bg-sidebar-accent/30 border border-sidebar-border flex justify-between items-center group">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-white">{entity.name}</span>
                                    <span className="text-sm text-blue-400 font-medium">{formatCurrency(entity.targetValue)}</span>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-sidebar-accent border-sidebar-border">
                                        <DropdownMenuItem onClick={() => handleEdit(entity)} className="text-blue-400"><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => deleteEntity(entity.id)} className="text-red-400"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-border sticky bottom-0 bg-card">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-400 font-medium">Total Reservado:</span>
                        <span className="text-xl font-bold text-blue-400">{formatCurrency(totalReserved)}</span>
                    </div>
                </div>

                <AlertDialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader><AlertDialogTitle>{editingEntity ? "Editar Entidade" : "Nova Entidade"}</AlertDialogTitle></AlertDialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Nome da Entidade</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Fundo de Segurança Anúncios" className="bg-input" /></div>
                            <div className="space-y-2"><Label>Valor Alvo (R$)</Label><Input value={`R$ ${displayValue}`} onChange={handleChange} className="bg-input" /></div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setIsAddOpen(false)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">Salvar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </SheetContent>
        </Sheet>
    );
};

const FundoDeCaixa = () => {
  const { addTransaction, updateTransaction, deleteTransaction, useFilteredTransactionsSummary } = useFinance();
  const { entities } = useReserveEntities();
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState<"Todos" | TransactionType>("Todos");
  const [dateFilter, setDateFilter] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });
  
  const { transactions: dateFilteredTransactions, isLoading: isLoadingInfinite, hasMore, loadMore, isFetching } = useInfiniteTransactions(dateFilter, customDateRange, [], "reserve");
  const { summary } = useFilteredTransactionsSummary(dateFilter, customDateRange, "reserve");
  
  const [riskAlertOpen, setRiskAlertOpen] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<Omit<Transaction, "id"> | null>(null);

  const totalReserved = useMemo(() => entities.reduce((sum, e) => sum + e.targetValue, 0), [entities]);

  const handleAddTransactionRequest = useCallback(async (data: Omit<Transaction, "id">) => {
    const currentBalance = summary.totalFundoCaixa;

    if (data.type === "Saída") {
        if (data.value > currentBalance) {
            showError(`Saldo insuficiente! O fundo possui apenas ${formatCurrency(currentBalance)}.`);
            return;
        }

        const newBalance = currentBalance - data.value;
        if (newBalance < totalReserved) {
            setPendingTransaction(data);
            setRiskAlertOpen(true);
            return;
        }
    }
    await addTransaction(data);
  }, [addTransaction, summary.totalFundoCaixa, totalReserved]);

  const confirmRiskTransaction = async () => {
    if (pendingTransaction) {
        await addTransaction(pendingTransaction);
    }
    setRiskAlertOpen(false);
    setPendingTransaction(null);
  };

  const filteredTransactions = useMemo(() => {
    let list = dateFilteredTransactions;
    if (activeTab === "Entrada") list = list.filter((t) => t.type === "Entrada");
    else if (activeTab === "Saída") list = list.filter((t) => t.type === "Saída");
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
        setShowFAB(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Layout pageTitle="Fundo de Caixa" pageSubtitle="Gestão estratégica de reservas e segurança financeira">
      <div className="space-y-6">
        <div 
          ref={headerRef}
          className="flex justify-between items-center lg:py-6 lg:mb-2"
        >
          <div>
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">Fundo de Caixa</h1>
            <p className="text-gray-400 mt-1">Gestão estratégica de reservas</p>
          </div>
          <div className="flex space-x-3 items-center">
            <VisibilityToggleButton />
            <EntityPanel />
            <TransactionFormDialog onSubmit={handleAddTransactionRequest} defaultType="Saída" accountType="reserve" trigger={<Button className="bg-red-600 hover:bg-red-700 text-white"><ArrowDown className="w-4 h-4 mr-2" />Nova Saída</Button>} />
            <TransactionFormDialog onSubmit={handleAddTransactionRequest} defaultType="Entrada" accountType="reserve" trigger={<Button className="bg-green-600 hover:bg-green-700 text-white"><ArrowUp className="w-4 h-4 mr-2" />Nova Entrada</Button>} />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard title="Aportes (Entradas)" value={summary.totalAportes} colorClass="text-green-500" icon={<ArrowUp className="w-4 h-4 text-green-500" />} gradientId="gradEntradasRes" />
          <SummaryCard title="Resgates (Saídas)" value={summary.totalResgates} colorClass="text-red-500" icon={<ArrowDown className="w-4 h-4 text-red-500" />} gradientId="gradSaidasRes" />
          <SummaryCard title="Total Reservado (Metas)" value={totalReserved} colorClass="text-blue-500" icon={<Lock className="w-4 h-4 text-blue-500" />} gradientId="gradReserved" />
        </div>

        <TotalInAccountStripReserve 
            value={summary.totalFundoCaixa} 
            contaPrincipal={summary.totalEmConta}
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
                            {group.transactions.map((t) => <TransactionItem key={t.id} transaction={t} onDelete={deleteTransaction} onEdit={updateTransaction} />)}
                        </React.Fragment>
                      ))}
                      {hasMore && (
                          <div className="p-4 text-center">
                              <Button variant="outline" onClick={() => loadMore()} disabled={isFetching} className="bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent">
                                {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Carregar Mais"}
                              </Button>
                          </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-gray-500 p-8">Nenhuma movimentação no fundo encontrada.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>

      <AlertDialog open={riskAlertOpen} onOpenChange={setRiskAlertOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="w-6 h-6" /> Atenção: Risco Operacional
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Este saque de <span className="font-bold text-white">{pendingTransaction ? formatCurrency(pendingTransaction.value) : ""}</span> afetará o fundo de proteção da empresa.
              <br /><br />
              Existem <span className="font-bold text-blue-400">{formatCurrency(totalReserved)}</span> reservador para Entidades (Segurança, IA, etc), e este saque deixará o saldo do fundo abaixo desse valor.
              <br /><br />
              Deseja prosseguir mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRiskAlertOpen(false); setPendingTransaction(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRiskTransaction} className="bg-orange-600 hover:bg-orange-700 text-white">Prosseguir com Saque</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* FABs: Visíveis no Mobile OU no Desktop quando o usuário rola para baixo */}
      {(isMobile || showFAB) && (
        <>
            <TransactionFormDialog onSubmit={handleAddTransactionRequest} defaultType="Entrada" accountType="reserve" trigger={<FloatingActionButton icon={<ArrowUp className="w-5 h-5" />} onClick={() => {}} colorClass="bg-green-600 hover:bg-green-700" size="fab-sm" className="bottom-24 right-6" />} />
            <TransactionFormDialog onSubmit={handleAddTransactionRequest} defaultType="Saída" accountType="reserve" trigger={<FloatingActionButton icon={<ArrowDown className="w-6 h-6" />} onClick={() => {}} colorClass="bg-red-600 hover:bg-red-700" size="fab-lg" className="bottom-6 right-6" />} />
        </>
      )}
    </Layout>
  );
};

export default FundoDeCaixa;