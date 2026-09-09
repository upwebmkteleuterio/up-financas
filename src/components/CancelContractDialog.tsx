import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, X } from "lucide-react";
import { Contract, ContractInstallment } from "@/types/finance";
import { cn } from "@/lib/utils";
import { format, parseISO, isPast, isToday } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface CancelContractDialogProps {
  trigger: React.ReactNode;
  contract: Contract;
  onConfirmCancel: (installmentIdsToCancel: string[]) => void;
}

const CancelContractDialog: React.FC<CancelContractDialogProps> = ({
  trigger,
  contract,
  onConfirmCancel,
}) => {
  const [open, setOpen] = useState(false);
  
  // Filtra apenas parcelas pendentes (isPaid: false)
  const pendingInstallments = useMemo(() => {
    return contract.installments.filter(i => !i.isPaid);
  }, [contract.installments]);
  
  // Estado para armazenar quais IDs de parcelas pendentes o usuário deseja cancelar
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<string[]>(
    pendingInstallments.map(i => i.id) // Seleciona todas por padrão
  );

  // Resetar o estado ao abrir/fechar
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedInstallmentIds(pendingInstallments.map(i => i.id));
    }
  };
  
  const handleCheckboxChange = (id: string, checked: boolean) => {
    setSelectedInstallmentIds(prev =>
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleConfirm = () => {
    onConfirmCancel(selectedInstallmentIds);
    setOpen(false);
  };
  
  const totalValueToCancel = pendingInstallments
    .filter(i => selectedInstallmentIds.includes(i.id))
    .reduce((sum, i) => sum + i.value, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[450px] bg-card border-border max-h-[calc(100vh-10px)] overflow-y-auto my-[5px]">
        <DialogHeader>
          <DialogTitle className="text-red-500 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Cancelar Contrato: {contract.clientName}
          </DialogTitle>
          <DialogDescription>
            Confirme o cancelamento do contrato e selecione as parcelas que deseja remover.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
                Deseja realmente cancelar este contrato? O contrato será marcado como cancelado no histórico e as parcelas não recebidas serão ocultadas.
            </p>
            
            <h4 className="text-base font-semibold text-foreground">
                Confirme as parcelas pendentes para cancelamento:
            </h4>

            {/* Lista de Parcelas Pendentes */}
            <div className="max-h-40 overflow-y-auto space-y-2 border border-border p-3 rounded-md bg-secondary/50">
                {pendingInstallments.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhuma parcela pendente.</p>
                ) : (
                    pendingInstallments.map((installment) => {
                        const dueDate = parseISO(installment.dueDate);
                        const isOverdue = isPast(dueDate) && !isToday(dueDate);
                        
                        return (
                            <div key={installment.id} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id={installment.id}
                                        checked={selectedInstallmentIds.includes(installment.id)}
                                        onCheckedChange={(checked) => handleCheckboxChange(installment.id, !!checked)}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor={installment.id} className="text-sm font-medium cursor-pointer">
                                        Parcela ({format(dueDate, 'dd/MM/yyyy')})
                                    </Label>
                                </div>
                                <span className={cn("font-semibold text-sm", isOverdue ? "text-red-400" : "text-foreground")}>
                                    {formatCurrency(installment.value)}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm font-semibold text-foreground">Valor Total a Cancelar:</span>
                <span className="text-lg font-bold text-red-500">
                    {formatCurrency(totalValueToCancel)}
                </span>
            </div>

            <p className="text-xs text-red-400 mt-2">
                Atenção: O contrato permanecerá no banco de dados para fins de histórico de vendas, mas não gerará novos recebimentos.
            </p>
        </div>

        <DialogFooter>
          <Button 
            type="button"
            variant="outline"
            onClick={() => setOpen(false)} 
            className="bg-secondary hover:bg-secondary/80 border-border"
          >
            Voltar
          </Button>
          <Button 
            onClick={handleConfirm} 
            className="bg-destructive hover:bg-destructive/90"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar Contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelContractDialog;