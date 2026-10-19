import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRecebimentos } from "@/hooks/useRecebimentos";
import { cn } from "@/lib/utils";
import { DollarSign, Calendar, CheckCircle } from "lucide-react";
import React, { useState, useMemo } from "react";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import SearchInput from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { showSuccess } from "@/utils/toast";
import MarkAsPaidDialog from "@/components/MarkAsPaidDialog";
import { useSales } from "@/hooks/useSales";
import HiddenValue from "@/components/HiddenValue";
import { useIsMobile } from "@/hooks/use-mobile";
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility";
import ContractItemSkeleton from "@/components/ContractItemSkeleton";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface SummaryStripProps {
  title: string;
  value: number;
  dateFilter: FilterPeriod;
}

const SummaryStrip: React.FC<SummaryStripProps> = ({ title, value, dateFilter }) => {
  const isMobile = useIsMobile();
  
  const getPeriodLabel = (filter: FilterPeriod) => {
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    if (filter.startsWith("month_")) {
      const monthIndex = parseInt(filter.split("_")[1]);
      return `(${monthNames[monthIndex]})`;
    }

    switch (filter) {
      case "current_month": return "(Mês Atual)";
      case "last_month": return "(Mês Passado)";
      case "next_month": return "(Mês Que Vem)";
      case "current_week": return "(Essa Semana)";
      case "next_week": return "(Semana Que Vem)";
      case "custom": return "(Período Personalizado)";
      default: return "";
    }
  };
  
  const mobileTitle = "Recebimentos";
  const finalTitle = isMobile ? mobileTitle : title;
  const periodLabel = isMobile ? getPeriodLabel(dateFilter) : "";

  return (
    <Card className="bg-card border-border shadow-xl">
      <CardContent className="flex justify-between items-center p-4">
        <span className="text-lg font-semibold text-foreground">
          {finalTitle}
        </span>
        <div className="flex flex-col items-end">
          <HiddenValue
            value={value}
            formatFn={formatCurrency}
            className="text-3xl font-extrabold text-green-400"
          />
          {isMobile && periodLabel && (
            <span className="text-xs text-gray-400 mt-1">{periodLabel}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface FutureMonthCardProps {
  monthName: string;
  total: number;
}

const FutureMonthCard: React.FC<FutureMonthCardProps> = ({ monthName, total }) => (
  <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-bold text-gray-400">
        {monthName}
      </CardTitle>
      <div className="p-1 rounded-full bg-green-900/50">
        <Calendar className="w-4 h-4 text-green-500" />
      </div>
    </CardHeader>
    <CardContent>
      <HiddenValue
        value={total}
        formatFn={formatCurrency}
        className="text-2xl font-bold text-green-400"
      />
    </CardContent>
  </Card>
);

interface RecebimentoItemProps {
  recebimento: ReturnType<typeof useRecebimentos>['recebimentos'][number];
  onMarkAsPaid: (
    contractId: string,
    installmentId: string,
    paymentDate: Date,
    paidValue: number,
    remainderAction?: 'add_to_next' | 'create_new',
    newInstallmentDate?: Date
  ) => void;
}

const RecebimentoItem: React.FC<RecebimentoItemProps> = ({ recebimento, onMarkAsPaid }) => {
  const formattedDueDate = format(parseISO(recebimento.dueDate), "dd/MM/yyyy");

  const handleConfirmPayment = (
    paymentDate: Date,
    paidValue: number,
    remainderAction?: 'add_to_next' | 'create_new',
    newInstallmentDate?: Date
  ) => {
    onMarkAsPaid(
        recebimento.contractId,
        recebimento.id,
        paymentDate,
        paidValue,
        remainderAction,
        newInstallmentDate
    );
    showSuccess(`Recebimento de ${formatCurrency(paidValue)} processado com sucesso.`);
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors group">
      <div className="flex items-center space-x-4 flex-1 min-w-0 w-full md:w-auto">
        <div className="p-2 rounded-lg bg-green-900/50 flex-shrink-0">
          <DollarSign className="w-5 h-5 text-green-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-semibold text-sidebar-primary-foreground truncate">
            {recebimento.clientName}
          </span>
          <span className="text-xs text-gray-400 mt-1 truncate">
            {recebimento.service} • Parcela {recebimento.id.slice(-4)}
          </span>
        </div>
      </div>
      <div className="flex justify-between items-center w-full md:w-auto md:ml-4 mt-3 md:mt-0 flex-shrink-0">
        <div className="flex flex-col items-start md:items-end">
          <HiddenValue
            value={recebimento.remaining}
            formatFn={formatCurrency}
            className="font-bold whitespace-nowrap text-lg"
          />
          <span className="text-xs text-gray-400 mt-1 whitespace-nowrap">Vencimento: {formattedDueDate}</span>
        </div>
        <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-4">
          <MarkAsPaidDialog
            installmentValue={recebimento.remaining}
            installmentDueDate={recebimento.dueDate}
            hasNextInstallment={recebimento.hasNextInstallment}
            onConfirm={handleConfirmPayment}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-500 hover:bg-green-900/20"
                title="Marcar como Pago"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
};

const Recebimentos = () => {
  const { filterRecebimentos, filterRecebidos, summary } = useRecebimentos();
  const { markInstallmentAsPaid, isLoadingContracts } = useSales();
  
  const [activeTab, setActiveTab] = useState<"a_receber" | "recebidos">("a_receber");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });

  const filteredRecebimentos = useMemo(() => {
    return filterRecebimentos(searchQuery, dateFilter, customDateRange);
  }, [filterRecebimentos, searchQuery, dateFilter, customDateRange]);

  const filteredRecebidos = useMemo(() => filterRecebidos(searchQuery, dateFilter, customDateRange), [filterRecebidos, searchQuery, dateFilter, customDateRange]);
  
  const totalRecebimentosFiltered = useMemo(() => {
      return filteredRecebimentos.reduce((sum, r) => sum + r.remaining, 0);
  }, [filteredRecebimentos]);

  const totalRecebidosFiltered = useMemo(() =>
    filteredRecebidos.reduce((sum, r) => sum + r.receivedValue, 0), [filteredRecebidos]
  );

  return (
    <Layout 
        pageTitle="Recebimentos" 
        pageSubtitle="Gerencie as parcelas futuras de contratos a receber."
    >
      <div className="space-y-6">
        <div className="hidden lg:flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
              Recebimentos
            </h1>
            <p className="text-gray-400 mt-1">
              Gerencie as parcelas futuras de contratos a receber.
            </p>
          </div>
          <VisibilityToggleButton />
        </div>

        <SummaryStrip
          title={activeTab === "a_receber" ? "Total de Recebimentos Pendentes (Período Filtrado)" : "Total Recebido (Período Filtrado)"}
          value={activeTab === "a_receber" ? totalRecebimentosFiltered : totalRecebidosFiltered}
          dateFilter={dateFilter}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.futureMonths.map((monthData, index) => (
            <FutureMonthCard
              key={index}
              monthName={monthData.monthName}
              total={monthData.total}
            />
          ))}
        </div>

        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "a_receber" | "recebidos")} className="w-full">
            <CardHeader className="p-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <SearchInput
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Buscar por cliente ou serviço..."
                  />
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
              
              <TabsList className="bg-sidebar-accent/50">
                <TabsTrigger value="a_receber">A receber ({filteredRecebimentos.length})</TabsTrigger>
                <TabsTrigger value="recebidos">Recebidos ({filteredRecebidos.length})</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="p-0">
              <TabsContent value="a_receber" className="mt-0">
                <div className="space-y-1">
                  {isLoadingContracts && filteredRecebimentos.length === 0 ? (
                    <div className="space-y-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <ContractItemSkeleton key={index} />
                        ))}
                    </div>
                  ) : filteredRecebimentos.length > 0 ? (
                    filteredRecebimentos.map((r) => (
                      <RecebimentoItem
                        key={`${r.contractId}-${r.id}`}
                        recebimento={r}
                        onMarkAsPaid={markInstallmentAsPaid}
                      />
                    ))
                  ) : (
                    <p className="text-center text-gray-500 p-8">
                      Nenhum recebimento pendente encontrado com os filtros aplicados.
                    </p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="recebidos" className="mt-0">
                <div className="space-y-1">
                  {isLoadingContracts && filteredRecebidos.length === 0 ? (
                    <div className="space-y-1">
                      {Array.from({ length: 5 }).map((_, index) => <ContractItemSkeleton key={index} />)}
                    </div>
                  ) : filteredRecebidos.length > 0 ? (
                    filteredRecebidos.map((recebido) => (
                      <div key={`${recebido.contractId}-${recebido.id}`} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors">
                        <div className="flex items-center space-x-4 flex-1 min-w-0 w-full md:w-auto">
                          <div className="p-2 rounded-lg bg-green-900/50 flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-green-500" />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-sidebar-primary-foreground truncate">{recebido.clientName}</span>
                            <span className="text-xs text-gray-400 mt-1 truncate">
                              {recebido.service} • Recebido em {format(parseISO(recebido.receivedDate), "dd/MM/yyyy")}{recebido.isPartial ? " • parcial" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end w-full md:w-auto md:ml-4 mt-3 md:mt-0 flex-shrink-0">
                          <HiddenValue
                            value={recebido.receivedValue}
                            formatFn={formatCurrency}
                            className="font-bold whitespace-nowrap text-lg text-green-500"
                          />
                          <span className="text-xs text-gray-400 mt-1 whitespace-nowrap">Vencimento: {format(parseISO(recebido.dueDate), "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 p-8">
                      Nenhum recebimento recebido encontrado com os filtros aplicados.
                    </p>
                  )}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
};

export default Recebimentos;