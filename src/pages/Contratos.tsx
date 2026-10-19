import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getContractRemaining, getInstallmentPaidInfo, useSales } from "@/hooks/useSales";
import { Contract, ContractInstallment, ContractType } from "@/types/finance";
import { cn } from "@/lib/utils";
import { DollarSign, CheckCircle, FileText, XCircle, Clock, TrendingUp } from "lucide-react";
import React, { useState, useMemo } from "react";
import { format, parseISO, isPast, isToday } from "date-fns";
import SearchInput from "@/components/SearchInput";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import ContractActionsMenu from "@/components/ContractActionsMenu"; 
import ContractFormDialog from "@/components/ContractFormDialog"; 
import { showSuccess } from "@/utils/toast"; 
import HiddenValue from "@/components/HiddenValue";
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

type ContractFilterType = ContractType | "Todos";
type ContractStatusFilterType = "Ativos" | "Finalizados" | "Cancelados";

const SummaryCard = ({ title, value, colorClass, icon }: any) => (
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
        formatFn={formatCurrency}
        className="text-2xl font-bold text-sidebar-primary-foreground"
      />
    </CardContent>
  </Card>
);

interface InstallmentStatusTagProps {
    installment: ContractInstallment;
    isContractCanceled: boolean; 
}

const InstallmentStatusTag: React.FC<InstallmentStatusTagProps> = ({ installment, isContractCanceled }) => {
    const baseClasses = "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap";

    if (isContractCanceled) {
        return <span className={cn(baseClasses, "bg-destructive/50 text-destructive-foreground")}>Cancelada</span>;
    }
    
    if (installment.isPaid) {
        const { isPartial } = getInstallmentPaidInfo(installment);
        if (isPartial) {
            return <span className={cn(baseClasses, "bg-orange-900/50 text-orange-400")}>Pago Parcial</span>;
        }
        return <span className={cn(baseClasses, "bg-green-900/50 text-green-400")}>Recebido</span>;
    }
    
    const dueDate = parseISO(installment.dueDate);
    if (isPast(dueDate) && !isToday(dueDate)) {
        return <span className={cn(baseClasses, "bg-red-900/50 text-red-400")}>Atrasado</span>;
    }
    
    return <span className={cn(baseClasses, "bg-yellow-900/50 text-yellow-400")}>A Receber</span>;
};

interface ContractCardProps {
    contract: Contract;
    onEdit: (contract: Contract) => void;
    onDelete: (id: string) => void;
    onDuplicate: (contract: Contract) => void;
    onCancel: (contract: Contract, installmentIdsToCancel: string[]) => void;
}

const ContractCard: React.FC<ContractCardProps> = ({ contract, onEdit, onDelete, onDuplicate, onCancel }) => {
    const totalRemaining = getContractRemaining(contract);
    const isFinished = totalRemaining <= 0;
    const isCanceled = contract.isCanceled;
    
    let statusLabel = "Ativo";
    let statusColor = "bg-blue-600";
    
    if (isCanceled) {
        statusLabel = "Cancelado";
        statusColor = "bg-red-600";
    } else if (isFinished) {
        statusLabel = "Finalizado";
        statusColor = "bg-green-600";
    }

    return (
        <Card className={cn(
            "bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg transition-shadow",
            isCanceled ? "opacity-70" : "hover:shadow-xl"
        )}>
            <CardHeader className="p-4 border-b border-sidebar-border flex flex-row items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {isCanceled ? <XCircle className="w-6 h-6 text-destructive" /> : <FileText className="w-6 h-6 text-sidebar-primary" />}
                    <CardTitle className="text-lg font-bold line-clamp-2 break-words flex-1 min-w-0">{contract.clientName}</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                    <ContractActionsMenu contract={contract} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} onCancel={onCancel} />
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-400">Serviço</p>
                        <p className="font-medium text-sidebar-primary-foreground">{contract.service}</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-gray-400">Valor Total</p>
                            <Badge className={cn("text-white shrink-0", statusColor)}>{statusLabel}</Badge>
                        </div>
                        <p className="font-bold text-green-500">{formatCurrency(contract.totalContractValue)}</p>
                    </div>
                </div>
                <Separator className="bg-sidebar-border" />
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-sidebar-primary-foreground">Parcelas ({contract.installments.length})</h4>
                    {contract.installments.map((installment, index) => {
                        const paidInfo = getInstallmentPaidInfo(installment);
                        return (
                            <div key={installment.id} className="grid grid-cols-3 items-center text-sm">
                                <div className="flex items-center space-x-1">
                                    <span className="font-medium text-sidebar-primary-foreground">{index + 1}</span>
                                    <span className="text-xs text-gray-500">({installment.dueDate ? format(parseISO(installment.dueDate), "dd/MM") : 'N/A'})</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sidebar-primary-foreground">{formatCurrency(installment.value)}</span>
                                    {paidInfo.isPartial && (
                                        <span className="text-[10px] text-orange-400">
                                            recebido {formatCurrency(paidInfo.received)} de {formatCurrency(paidInfo.original)}
                                        </span>
                                    )}
                                    {installment.isResidual && (
                                        <span className="text-[10px] text-purple-400">
                                            resíduo da parcela {installment.generatedFromNumber ?? "?"}
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-end">
                                    <InstallmentStatusTag installment={installment} isContractCanceled={isCanceled && !installment.isPaid} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Separator className="bg-sidebar-border" />
                <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-400">Pendente:</span>
                    <span className="text-red-500">{formatCurrency(totalRemaining)}</span>
                </div>
            </CardContent>
        </Card>
    );
};

const Contratos = () => {
  const { contracts, updateContract, deleteContract, summary, cancelContract } = useSales();
  const [searchQuery, setSearchQuery] = useState("");
  const [contractTypeFilter, setContractTypeFilter] = useState<ContractFilterType>("Todos");
  const [statusFilter, setStatusFilter] = useState<ContractStatusFilterType>("Ativos");
  
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    let list = contracts;

    if (statusFilter === "Ativos") {
        list = list.filter(c => {
            const isFinished = getContractRemaining(c) <= 0;
            return !c.isCanceled && !isFinished;
        });
    } else if (statusFilter === "Cancelados") {
        list = list.filter(c => c.isCanceled);
    } else if (statusFilter === "Finalizados") {
        list = list.filter(c => {
            const isFinished = getContractRemaining(c) <= 0;
            return isFinished && !c.isCanceled;
        });
    }

    if (contractTypeFilter !== "Todos") list = list.filter(c => c.contractType === contractTypeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.clientName.toLowerCase().includes(q) || c.service.toLowerCase().includes(q));
    }
    
    return [...list].sort((a, b) => parseISO(b.dateClosed).getTime() - parseISO(a.dateClosed).getTime());
  }, [contracts, searchQuery, contractTypeFilter, statusFilter]);

  const handleUpdateContract = (data: Omit<Contract, "id">, id?: string) => {
    if (id) {
        updateContract({ ...data, id } as Contract);
        showSuccess("Contrato atualizado com sucesso!");
        setEditingContract(null);
    }
  };

  return (
    <Layout pageTitle="Contratos" pageSubtitle="Gestão de recebíveis e saúde dos contratos.">
      <div className="space-y-6">
        <div className="hidden lg:flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-sidebar-primary-foreground">Contratos</h1>
                <p className="text-gray-400 mt-1">Gestão de recebíveis e saúde dos contratos.</p>
            </div>
            <VisibilityToggleButton />
        </div>

        {/* Seção de KPIs de Contratos Ativos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard 
                title="Total a Receber" 
                value={summary.totalAReceber} 
                colorClass="bg-yellow-900/50" 
                icon={<DollarSign className="w-4 h-4 text-yellow-500" />} 
            />
            <SummaryCard 
                title="Total em Atraso" 
                value={summary.totalEmAtraso} 
                colorClass="bg-red-900/50" 
                icon={<Clock className="w-4 h-4 text-red-500" />} 
            />
            <SummaryCard 
                title="Total Recebido" 
                value={summary.totalRecebidoAtivos} 
                colorClass="bg-green-900/50" 
                icon={<TrendingUp className="w-4 h-4 text-green-500" />} 
            />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <SearchInput value={searchQuery} onChange={setSearchQuery} />
            <div className="flex space-x-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-sidebar-accent/50 border-sidebar-border">
                            {statusFilter === "Ativos" ? <Clock className="w-4 h-4 mr-2 text-blue-400" /> : statusFilter === "Finalizados" ? <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> : <XCircle className="w-4 h-4 mr-2 text-red-400" />}
                            {statusFilter}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem onSelect={() => setStatusFilter("Ativos")}>Ativos</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusFilter("Finalizados")}>Finalizados</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusFilter("Cancelados")}>Cancelados</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContracts.map((c) => (
            <ContractCard key={c.id} contract={c} onEdit={setEditingContract} onDelete={deleteContract} onDuplicate={() => {}} onCancel={cancelContract} />
          ))}
        </div>
      </div>

      {editingContract && (
          <ContractFormDialog 
            open={!!editingContract} 
            onOpenChange={(open) => !open && setEditingContract(null)} 
            initialData={editingContract}
            onSubmit={handleUpdateContract} 
            trigger={<div/>} 
          />
      )}
    </Layout>
  );
};

export default Contratos;