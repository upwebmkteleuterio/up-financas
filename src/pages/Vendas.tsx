import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSales } from "@/hooks/useSales";
import { Contract } from "@/types/finance";
import { cn, createLocalDateFromISO } from "@/lib/utils";
import { DollarSign, Phone, Trash2, Pencil, Users, TrendingUp, Plus, XCircle, FileText } from "lucide-react";
import ContractFormDialog from "@/components/ContractFormDialog";
import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { showSuccess } from "@/utils/toast";
import { format, parseISO } from "date-fns";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import SearchInput from "@/components/SearchInput";
import HiddenValue from "@/components/HiddenValue";
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility";
import { useIsMobile } from "@/hooks/use-mobile";
import FloatingActionButton from "@/components/FloatingActionButton";
import ContractListActionsMenu from "@/components/ContractListActionsMenu";
import { filterContractsList } from "@/utils/financeFilters";
import ContractItemSkeleton from "@/components/ContractItemSkeleton";

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Componente para o Card de Resumo
const SummaryCard = ({ title, value, colorClass, icon, isCurrency = true }: any) => (
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
        formatFn={isCurrency ? formatCurrency : (v) => Math.round(v).toString()}
        className="text-2xl font-bold text-sidebar-primary-foreground"
        isCurrency={isCurrency}
      />
    </CardContent>
  </Card>
);

// Componente para a Linha de Contrato (Venda)
interface SaleItemProps {
    contract: Contract;
    onEdit: (contract: Contract) => void;
    onDelete: (id: string) => void;
    onDuplicate: (contract: Contract) => void;
}

const SaleItem: React.FC<SaleItemProps> = ({ contract, onEdit, onDelete, onDuplicate }) => {
    const isCanceled = contract.isCanceled;
    const formattedDate = format(createLocalDateFromISO(contract.dateClosed), "dd/MM/yyyy");

    return (
        <div className={cn(
            "flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors group",
            isCanceled && "opacity-60"
        )}>
            {/* Detalhes do Cliente */}
            <div className="flex items-center space-x-4 flex-1 min-w-0 w-full md:w-auto">
                <div className={cn(
                    "p-2 rounded-lg flex-shrink-0",
                    isCanceled ? "bg-red-900/30" : "bg-green-900/50"
                )}>
                    {isCanceled ? <XCircle className="w-5 h-5 text-red-500" /> : <FileText className="w-5 h-5 text-green-500" />}
                </div>
                
                <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold text-sidebar-primary-foreground truncate">
                        {contract.clientName}
                    </span>
                    <span className="text-xs text-gray-400 mt-1 truncate">
                        {contract.service} • {contract.contractType}
                    </span>
                </div>
            </div>
            
            {/* Valor, Data e Ações */}
            <div className="flex justify-between items-center w-full md:w-auto md:ml-4 mt-3 md:mt-0 flex-shrink-0">
                
                <div className="hidden md:flex items-center text-sm text-gray-400 mr-8">
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    {contract.phone}
                </div>

                <div className="flex flex-col items-start md:items-end">
                    <HiddenValue
                        value={contract.totalContractValue}
                        formatFn={formatCurrency}
                        className={cn("font-bold whitespace-nowrap text-lg", isCanceled ? "text-gray-500 line-through" : "text-green-500")}
                    />
                    <span className="text-xs text-gray-400 mt-1 whitespace-nowrap">Fechado em: {formattedDate}</span>
                </div>

                {/* Ações */}
                <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-4">
                    <ContractListActionsMenu
                        contract={contract}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                    />
                </div>
            </div>
        </div>
    );
};

const Vendas = () => {
  const { addContract, updateContract, deleteContract, contracts, isLoadingContracts } = useSales();
  const isMobile = useIsMobile();
  
  // Estados de Filtro
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [customDateRange, setCustomDateRange] = useState({ start: undefined, end: undefined });
  const [statusFilter, setStatusFilter] = useState<"Ativos" | "Cancelados">("Ativos");
  
  // Estados de Controle de Modais
  const [isCreatingNewContract, setIsCreatingNewContract] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [duplicatingContract, setDuplicatingContract] = useState<Contract | null>(null);

  // Lógica de Resumo Reativo
  const summaryFiltered = useMemo(() => {
      // Para o resumo, consideramos o volume total independente de estar ativo ou cancelado (histórico comercial)
      const periodContracts = filterContractsList(contracts, "", dateFilter, customDateRange, false);
      const periodCancelados = filterContractsList(contracts, "", dateFilter, customDateRange, true);
      const all = [...periodContracts, ...periodCancelados];

      const total = all.reduce((sum, c) => sum + c.totalContractValue, 0);
      const count = all.length;
      
      return {
          total,
          count,
          average: count > 0 ? total / count : 0
      };
  }, [contracts, dateFilter, customDateRange]);

  // Lista Filtrada para Exibição
  const listForDisplay = useMemo(() => {
    return filterContractsList(
        contracts, 
        searchQuery, 
        dateFilter, 
        customDateRange, 
        statusFilter === "Cancelados"
    );
  }, [contracts, searchQuery, dateFilter, customDateRange, statusFilter]);

  const handleAddContract = (data: Omit<Contract, "id">) => {
    addContract(data);
    showSuccess("Contrato registrado com sucesso!");
    setIsCreatingNewContract(false);
  };

  const handleUpdateContract = (data: Omit<Contract, "id">, id?: string) => {
    if (id) {
        updateContract({ ...data, id } as Contract);
        showSuccess("Contrato atualizado com sucesso!");
        setEditingContract(null);
    }
  };

  const handleDuplicateContract = (data: Omit<Contract, "id">) => {
    addContract(data);
    showSuccess("Contrato duplicado com sucesso!");
    setDuplicatingContract(null);
  };

  // Gatilho do FAB
  const fabTrigger = (
    <FloatingActionButton
        icon={<Plus className="w-6 h-6" />}
        onClick={() => setIsCreatingNewContract(true)}
        colorClass="bg-green-600 hover:bg-green-700"
    />
  );

  return (
    <Layout 
        pageTitle="Vendas" 
        pageSubtitle="Registro histórico de contratos e performance comercial."
    >
      <div className="space-y-6">
        {/* Header Desktop */}
        <div className="hidden lg:flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">Vendas</h1>
            <p className="text-gray-400 mt-1">Histórico completo de negociações fechadas.</p>
          </div>
          <div className="flex space-x-3 items-center">
            <VisibilityToggleButton /> 
            <Button 
                onClick={() => setIsCreatingNewContract(true)} 
                className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Contrato
            </Button>
          </div>
        </div>
        
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard 
            title="Volume de Vendas" 
            value={summaryFiltered.total} 
            colorClass="bg-green-900/50" 
            icon={<DollarSign className="w-4 h-4 text-green-500" />} 
          />
          <SummaryCard 
            title="Nº de Contratos" 
            value={summaryFiltered.count} 
            colorClass="bg-blue-900/50" 
            icon={<Users className="w-4 h-4 text-blue-500" />} 
            isCurrency={false} 
          />
          <SummaryCard 
            title="Ticket Médio" 
            value={summaryFiltered.average} 
            colorClass="bg-yellow-900/50" 
            icon={<TrendingUp className="w-4 h-4 text-yellow-500" />} 
          />
        </div>

        {/* Barra de Busca e Filtros */}
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <SearchInput 
                    value={searchQuery} 
                    onChange={setSearchQuery} 
                    placeholder="Buscar por cliente ou serviço..."
                />
                <div className="flex space-x-2">
                    <Button 
                        variant="outline" 
                        className={cn("bg-sidebar-accent/50", statusFilter === "Ativos" && "border-blue-500 text-blue-400")} 
                        onClick={() => setStatusFilter("Ativos")}
                    >
                        Ativos
                    </Button>
                    <Button 
                        variant="outline" 
                        className={cn("bg-sidebar-accent/50", statusFilter === "Cancelados" && "border-red-500 text-red-400")} 
                        onClick={() => setStatusFilter("Cancelados")}
                    >
                        Cancelados
                    </Button>
                    <FilterDropdown 
                        activeFilter={dateFilter} 
                        setActiveFilter={setDateFilter} 
                        customDateRange={customDateRange} 
                        setCustomDateRange={setCustomDateRange as any} 
                    />
                </div>
            </div>
            <Separator className="my-4 bg-sidebar-border" />
            <CardTitle className="text-xl font-bold">
                Contratos {statusFilter} ({listForDisplay.length})
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-0">
              <div className="space-y-1">
                  {isLoadingContracts && listForDisplay.length === 0 ? (
                      Array.from({ length: 5 }).map((_, i) => <ContractItemSkeleton key={i} />)
                  ) : listForDisplay.length > 0 ? (
                      listForDisplay.map(c => (
                          <SaleItem 
                            key={c.id} 
                            contract={c} 
                            onEdit={setEditingContract} 
                            onDelete={deleteContract}
                            onDuplicate={setDuplicatingContract}
                          />
                      ))
                  ) : (
                      <p className="text-center text-gray-500 p-8">Nenhum contrato encontrado.</p>
                  )}
              </div>
          </CardContent>
        </Card>
      </div>
      
      {/* FAB para Mobile */}
      {isMobile && fabTrigger}

      {/* Modais Controlados */}
      {isCreatingNewContract && (
          <ContractFormDialog 
            open={isCreatingNewContract} 
            onOpenChange={setIsCreatingNewContract} 
            onSubmit={handleAddContract} 
            trigger={<div/>} 
          />
      )}

      {editingContract && (
          <ContractFormDialog 
            open={!!editingContract} 
            onOpenChange={(open) => !open && setEditingContract(null)} 
            initialData={editingContract}
            onSubmit={handleUpdateContract} 
            trigger={<div/>} 
          />
      )}

      {duplicatingContract && (
          <ContractFormDialog 
            open={!!duplicatingContract} 
            onOpenChange={(open) => !open && setDuplicatingContract(null)} 
            initialData={duplicatingContract}
            onSubmit={handleDuplicateContract} 
            trigger={<div/>} 
          />
      )}
    </Layout>
  );
};

export default Vendas;