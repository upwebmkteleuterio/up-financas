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
import { CheckCircle, Calendar as CalendarIcon, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DatePicker } from "./DatePicker";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface MarkAsPaidDialogProps {
  trigger: React.ReactNode;
  installmentValue: number;
  installmentDueDate: string;
  hasNextInstallment?: boolean;
  onConfirm: (
    paymentDate: Date,
    paidValue: number,
    remainderAction?: 'add_to_next' | 'create_new',
    newInstallmentDate?: Date
  ) => void;
}

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const MarkAsPaidDialog: React.FC<MarkAsPaidDialogProps> = ({
  trigger,
  installmentValue,
  installmentDueDate,
  hasNextInstallment = true,
  onConfirm,
}) => {
  const initialPaymentDate = parseISO(installmentDueDate);
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(initialPaymentDate);
  const { displayValue, numericValue: paidValue, handleChange: handlePaidValueChange, setNumericValue: setPaidValue } = useCurrencyInput(installmentValue);
  
  const [remainderAction, setRemainderAction] = useState<'add_to_next' | 'create_new'>(hasNextInstallment ? 'add_to_next' : 'create_new');
  const [newInstallmentDate, setNewInstallmentDate] = useState<Date | undefined>(undefined);

  const isPartial = paidValue < installmentValue && paidValue > 0;
  const remainder = installmentValue - paidValue;

  const handleConfirm = () => {
    if (paymentDate) {
      onConfirm(
        paymentDate,
        paidValue,
        isPartial ? remainderAction : undefined,
        remainderAction === 'create_new' ? newInstallmentDate : undefined
      );
      setOpen(false);
    }
  };
  
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
        setPaymentDate(initialPaymentDate);
        setPaidValue(installmentValue);
        setRemainderAction(hasNextInstallment ? 'add_to_next' : 'create_new');
        setNewInstallmentDate(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border max-h-[calc(100vh-20px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-500 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            Confirmar Recebimento
          </DialogTitle>
          <DialogDescription>
            Informe os detalhes do pagamento recebido para baixar esta parcela.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="p-3 bg-secondary/30 border border-border rounded-lg space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold">Valor Original da Parcela</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(installmentValue)}</p>
            </div>

            <p className="text-sm text-muted-foreground">
                Confirme o valor realmente recebido e a data do pagamento.
            </p>

            {/* Valor Recebido */}
            <div className="space-y-2">
                <Label htmlFor="paidValue">Valor Recebido (R$)</Label>
                <Input
                    id="paidValue"
                    value={`R$ ${displayValue}`}
                    onChange={handlePaidValueChange}
                    className="bg-input font-bold text-lg text-green-500"
                />
            </div>

            {/* Data de Pagamento */}
            <div className="space-y-2">
                <Label htmlFor="paymentDate">Data de Recebimento</Label>
                <DatePicker
                    date={paymentDate}
                    setDate={setPaymentDate}
                    placeholder="Selecione a data"
                />
            </div>

            {/* Lógica de Recebimento Parcial */}
            {isPartial && (
                <div className="mt-4 p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start space-x-2 text-yellow-500">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Recebimento Parcial Detectado</p>
                            <p className="text-xs opacity-80">Faltam <span className="font-bold">{formatCurrency(remainder)}</span> para quitar esta parcela. O que deseja fazer com este saldo?</p>
                        </div>
                    </div>

                    <RadioGroup value={remainderAction} onValueChange={(v: any) => setRemainderAction(v)} className="space-y-2">
                        <div className={cn("flex items-center space-x-2", !hasNextInstallment && "opacity-50 cursor-not-allowed")}>
                            <RadioGroupItem value="add_to_next" id="next" disabled={!hasNextInstallment} />
                            <Label htmlFor="next" className={cn("text-xs cursor-pointer", !hasNextInstallment && "cursor-not-allowed")}>
                                Somar valor na próxima parcela existente {!hasNextInstallment && "(Indisponível - Última parcela)"}
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="create_new" id="new" />
                            <Label htmlFor="new" className="text-xs cursor-pointer">Criar uma nova data/parcela para este resíduo</Label>
                        </div>
                    </RadioGroup>

                    {remainderAction === 'create_new' && (
                        <div className="space-y-2 pt-2 animate-in zoom-in-95">
                            <Label className="text-xs">Nova Data de Vencimento</Label>
                            <DatePicker
                                date={newInstallmentDate}
                                setDate={setNewInstallmentDate}
                                placeholder="Selecione a nova data"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!paymentDate || (isPartial && remainderAction === 'create_new' && !newInstallmentDate)}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {isPartial ? "Confirmar Recebimento Parcial" : "Confirmar Recebimento Total"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarkAsPaidDialog;