import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMarketing } from "@/hooks/useMarketing";
import { MarketingInvestment } from "@/types/finance";
import { cn } from "@/lib/utils";
import { DollarSign, Megaphone, Trash2, Pencil, Users, TrendingUp, Zap, Plus } from "lucide-react";
import MarketingInvestmentFormDialog from "@/components/MarketingInvestmentFormDialog";
import React, { useState, useMemo } from "react";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import { showSuccess } from "@/utils/toast";
import { format, parseISO } from "date-fns";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown"; // Importando FilterDropdown
import HiddenValue from "@/components/HiddenValue"; // Importando HiddenValue
import { useIsMobile } from "@/hooks/use-mobile"; // Importando useIsMobile
import FloatingActionButton from "@/components/FloatingActionButton"; // Importando FAB
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility"; // Importando o botão de toggle

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
  isCurrency?: boolean;
  isPercentage?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  colorClass,
  icon,
  isCurrency = true,
  isPercentage = false,
}) => (
  <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">
        {title}
      </CardTitle>
      <div className={cn("p-1 rounded-full", colorClass)}>{icon}</div>
    </CardHeader>
    <CardContent>
      <HiddenValue
        value={value}
        formatFn={
            isCurrency 
                ? formatCurrency 
                : isPercentage 
                ? (v) => `${v.toFixed(2)}%`
                : (v) => Math.round(v).toString()
        }
        className="text-2xl font-bold text-sidebar-primary-foreground"
        isCurrency={isCurrency}
      />
    </CardContent>
  </Card>
);

// Componente para a Faixa de Resumo (Total em Vendas)
interface SummaryStripProps {
  title: string;
  value: number;
  color: string;
  dateFilter: FilterPeriod; // Adicionando filtro de data
}

const SummaryStrip: React.FC<SummaryStripProps> = ({ title, value, color, dateFilter }) => {
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
      case "custom": return "(Período Personalizado)";
      default: return "";
    }
  };
  
  const mobileTitle = "Vendas";
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
            className={cn("text-3xl font-extrabold", color)}
          />
          {isMobile && periodLabel && (
            <span className="text-xs text-gray-400 mt-1">{periodLabel}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


// Componente para a Linha de Investimento
interface InvestmentItemProps {
  investment: MarketingInvestment;
  onDelete: (id: string) => void;
  onEdit: (updatedInvestment: MarketingInvestment) => void;
}

const InvestmentItem: React.FC<InvestmentItemProps> = ({ 
  investment, 
  onDelete, 
  onEdit 
}) => {
  
  const formattedDate = format(parseISO(investment.date), "dd/MM/yyyy");
  
  const totalSalesValue = investment.associatedSales.reduce((sum, s) => sum + s.saleValue, 0);
  const numberOfClients = investment.associatedSales.length;
  
  // Métricas por Investimento
  const cpl = (investment.leads || 0) > 0 ? investment.investmentValue / investment.leads! : 0;
  const cpa = numberOfClients > 0 ? investment.investmentValue / numberOfClients : 0;
  const averageTicket = numberOfClients > 0 ? totalSalesValue / numberOfClients : 0;

  const handleDelete = () => {
    onDelete(investment.id);
    showSuccess("Investimento de marketing excluído com sucesso.");
  };

  const handleEditSubmit = (data: Omit<MarketingInvestment, "id">, id?: string) => {
    if (id) {
      onEdit({ ...data, id });
      showSuccess("Investimento de marketing atualizado com sucesso!");
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors group">
      
      {/* Coluna 1: Nome, Categoria e Data (40% no desktop, 100% no mobile) */}
      <div className="flex items-center space-x-4 flex-1 min-w-0 w-full lg:w-[40%]">
        <div className="p-2 rounded-lg bg-blue-900/50 flex-shrink-0">
          <Zap className="w-5 h-5 text-blue-500" />
        </div>
        
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-semibold text-sidebar-primary-foreground truncate">
            {investment.name}
          </span>
          <span className="text-xs text-gray-400 mt-1 truncate">
            {investment.category} - {formattedDate}
          </span>
        </div>
      </div>
      
      {/* Colunas de Métricas (60% restante no desktop, nova linha no mobile) */}
      <div className="flex flex-wrap justify-between lg:flex-row text-sm text-gray-400 w-full lg:w-[60%] flex-shrink-0 mt-3 lg:mt-0">
        
        {/* Container das 5 Métricas */}
        <div className="flex flex-1 flex-wrap lg:flex-nowrap">
            {/* Coluna 2: Investimento */}
            <div className="flex flex-col items-start justify-center w-1/2 lg:w-auto flex-1 px-2 py-1">
              <HiddenValue
                value={investment.investmentValue}
                formatFn={formatCurrency}
                className="font-bold text-red-500 whitespace-nowrap"
              />
              <span className="text-xs text-gray-500 mt-1 whitespace-nowrap lg:hidden">Investimento</span>
            </div>
            
            {/* Coluna 3: Leads / CPL */}
            <div className="flex flex-col items-start justify-center w-1/2 lg:w-auto flex-1 px-2 py-1">
              <HiddenValue
                value={investment.leads || 0}
                isCurrency={false}
                className="font-medium text-sidebar-primary-foreground whitespace-nowrap"
              />
              <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                CPL: <HiddenValue value={cpl} formatFn={formatCurrency} className="inline" />
              </span>
            </div>
            
            {/* Coluna 4: Clientes / CPA */}
            <div className="flex flex-col items-start justify-center w-1/2 lg:w-auto flex-1 px-2 py-1">
              <HiddenValue
                value={numberOfClients}
                isCurrency={false}
                className="font-medium text-sidebar-primary-foreground whitespace-nowrap"
              />
              <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                CPA: <HiddenValue value={cpa} formatFn={formatCurrency} className="inline" />
              </span>
            </div>
            
            {/* Coluna 5: Vendas */}
            <div className="flex flex-col items-start justify-center w-1/2 lg:w-auto flex-1 px-2 py-1">
                <HiddenValue
                    value={totalSalesValue}
                    formatFn={formatCurrency}
                    className="font-bold text-green-500 whitespace-nowrap"
                />
                <span className="text-xs text-gray-500 mt-1 whitespace-nowrap lg:hidden">Vendas</span>
            </div>
            
            {/* Coluna 6: Ticket Médio */}
            <div className="flex flex-col items-start justify-center w-1/2 lg:w-auto flex-1 px-2 py-1">
                <HiddenValue
                    value={averageTicket}
                    formatFn={formatCurrency}
                    className="font-medium text-sidebar-primary-foreground whitespace-nowrap"
                />
                <span className="text-xs text-gray-500 mt-1 whitespace-nowrap lg:hidden">Ticket Médio</span>
            </div>
        </div>

        {/* Coluna 7: Ações (Fixo w-16) */}
        <div className="flex space-x-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-4 flex-shrink-0 mt-3 lg:mt-0 w-full lg:w-16 justify-end">
          
          {/* Botão Editar */}
          <MarketingInvestmentFormDialog
            initialData={investment}
            onSubmit={handleEditSubmit}
            trigger={
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-sidebar-foreground hover:bg-accent"
                title="Editar Investimento"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            }
          />
          
          {/* Botão Excluir */}
          <DeleteConfirmationDialog
            title="Confirmar Exclusão"
            description={`Tem certeza que deseja excluir o investimento "${investment.name}"?`}
            onConfirm={handleDelete}
            trigger={
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-red-500 hover:bg-red-900/20"
                title="Excluir Investimento"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
};

const Marketing = () => {
  const { investments, addInvestment, updateInvestment, deleteInvestment, filterInvestments, summary } = useMarketing();
  
  // Estados para Filtro
  const [dateFilter, setDateFilter] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });

  const handleAddInvestment = (data: Omit<MarketingInvestment, "id">) => {
    addInvestment(data);
    showSuccess("Investimento de marketing cadastrado com sucesso!");
  };

  // Aplica a filtragem
  const filteredInvestments = useMemo(() => {
    return filterInvestments(dateFilter, customDateRange);
  }, [filterInvestments, dateFilter, customDateRange]);
  
  // Calcula o total de vendas dos investimentos filtrados
  const totalSalesFiltered = useMemo(() => {
      return filteredInvestments.flatMap(i => i.associatedSales).reduce((sum, s) => sum + s.saleValue, 0);
  }, [filteredInvestments]);
  
  // NOVO: Calcula o total de investimento do período filtrado
  const totalInvestmentFiltered = useMemo(() => {
      return filteredInvestments.reduce((sum, i) => sum + i.investmentValue, 0);
  }, [filteredInvestments]);


  // Cálculo do ROI (Retorno sobre Investimento) - Mantendo o cálculo geral no summary, mas podemos calcular o ROI filtrado se necessário.
  const roi = summary.totalInvestment > 0 
    ? ((summary.totalSalesValue - summary.totalInvestment) / summary.totalInvestment) * 100 
    : 0;
    
  // Modal Trigger para o FAB
  const fabTrigger = (
    <FloatingActionButton
        icon={<Plus className="w-6 h-6" />}
        onClick={() => { /* Abre o modal */ }}
        colorClass="bg-blue-600 hover:bg-blue-700"
    />
  );

  return (
    <Layout 
        pageTitle="Marketing" 
        pageSubtitle="Gerencie investimentos, leads e vendas associadas."
    >
      <div className="space-y-6">
        {/* Header e Botão Novo Investimento - Visível apenas em telas maiores (lg:flex) */}
        <div className="hidden lg:flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
              Marketing
            </h1>
            <p className="text-gray-400 mt-1">
              Gerencie investimentos, leads e vendas associadas.
            </p>
          </div>
          <div className="flex space-x-3 items-center">
            <VisibilityToggleButton /> {/* Adicionado o botão de visibilidade */}
            <MarketingInvestmentFormDialog 
              onSubmit={handleAddInvestment} 
              trigger={
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Megaphone className="w-4 h-4 mr-2" />
                  + Novo Investimento
                </Button>
              }
            />
          </div>
        </div>
        
        {/* Botão Novo Investimento - Oculto no mobile/tablet */}
        <div className="flex lg:hidden justify-end hidden">
            {/* Conteúdo oculto, o FAB será o trigger */}
        </div>

        {/* Faixa Total em Vendas (Nova Faixa) */}
        <SummaryStrip
          title="Total em Vendas (Período Filtrado)"
          value={totalSalesFiltered}
          color="text-green-400"
          dateFilter={dateFilter} // Passando o filtro de data
        />

        {/* Cards de Resumo (4 Colunas) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            title="Investimento (Período Filtrado)" // Título atualizado
            value={totalInvestmentFiltered} // Valor atualizado
            colorClass="bg-red-900/50"
            icon={<DollarSign className="w-4 h-4 text-red-500" />}
          />
          <SummaryCard
            title="Total de Leads"
            value={summary.totalLeads}
            colorClass="bg-yellow-900/50"
            icon={<Users className="w-4 h-4 text-yellow-500" />}
            isCurrency={false}
          />
          <SummaryCard
            title="Custo por Aquisição (CPA)"
            value={summary.averageCPA}
            colorClass="bg-purple-900/50"
            icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
          />
          <SummaryCard
            title="ROI Geral"
            value={roi}
            colorClass={roi >= 0 ? "bg-green-900/50" : "bg-red-900/50"}
            icon={<TrendingUp className="w-4 h-4 text-green-500" />}
            isCurrency={false}
            isPercentage={true}
          />
        </div>

        {/* Lista de Investimentos */}
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader className="p-4">
            <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold">
                    Investimentos ({filteredInvestments.length})
                </CardTitle>
                <FilterDropdown
                    activeFilter={dateFilter}
                    setActiveFilter={setDateFilter}
                    customDateRange={customDateRange}
                    setCustomDateRange={setCustomDateRange}
                    // Exibindo os 12 meses e Personalizado
                    allowedFilters={[
                        "month_0", "month_1", "month_2", "month_3", "month_4", "month_5",
                        "month_6", "month_7", "month_8", "month_9", "month_10", "month_11",
                        "custom"
                    ]}
                />
            </div>
            <Separator className="my-4 bg-sidebar-border" />
          </CardHeader>
          <CardContent className="p-0">
            
            {/* Cabeçalho da Tabela - ESTRUTURA CORRIGIDA */}
            <div className="hidden lg:flex items-center p-4 text-xs font-semibold uppercase text-gray-500 border-b border-sidebar-border">
                
                {/* Coluna 1: Nome e Data (40%) */}
                <span className="w-[40%]">Nome e Data</span>
                
                {/* Colunas de Métricas (60%) */}
                <div className="flex flex-1 items-center">
                    {/* 5 colunas flex-1 para métricas */}
                    <span className="flex-1 px-2 text-left">Investimento</span>
                    <span className="flex-1 px-2 text-left">Leads</span>
                    <span className="flex-1 px-2 text-left">Clientes</span>
                    <span className="flex-1 px-2 text-left">Vendas</span>
                    <span className="flex-1 px-2 text-left">Ticket Médio</span>
                </div>
                
                {/* Coluna 7: Ações (Fixo w-16) */}
                <span className="w-16 text-right ml-4 flex-shrink-0">Ações</span>
            </div>

            <div className="space-y-1">
              {filteredInvestments.length > 0 ? (
                filteredInvestments.map((i) => (
                  <InvestmentItem 
                    key={i.id} 
                    investment={i} 
                    onDelete={deleteInvestment} 
                    onEdit={updateInvestment}
                  />
                ))
              ) : (
                <p className="text-center text-gray-500 p-8">
                  Nenhum investimento encontrado com os filtros aplicados.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* FAB para Novo Investimento (Mobile Only) */}
      <MarketingInvestmentFormDialog 
        onSubmit={handleAddInvestment} 
        trigger={fabTrigger}
      />
    </Layout>
  );
};

export default Marketing;