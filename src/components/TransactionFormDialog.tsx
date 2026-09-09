"use client";

import React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Transaction, TransactionType, PaymentMethod, subcategories, AccountType } from "@/types/finance";
import { DatePicker } from "./DatePicker";
import { FolderOpen, Save, PlusCircle, Calculator as CalcIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactionForm } from "@/hooks/useTransactionForm";
import DescriptionAutocomplete from "./transaction-form/DescriptionAutocomplete";
import SaidaSubgroupFields from "./transaction-form/SaidaSubgroupFields";
import TransactionTemplateDialog from "./TransactionTemplateDialog";
import CalculatorDialog from "./CalculatorDialog";

interface TransactionFormDialogProps {
  trigger: React.ReactNode;
  initialData?: Transaction;
  onSubmit: (transaction: Omit<Transaction, "id">, id?: string) => void;
  onClose?: () => void;
  defaultType?: TransactionType;
  accountType?: AccountType;
}

const TransactionFormDialog: React.FC<TransactionFormDialogProps> = ({
  trigger,
  initialData,
  onSubmit,
  onClose,
  defaultType,
  accountType = "main",
}) => {
  const [open, setOpen] = React.useState(false);

  const {
    formData,
    setFormData,
    activeSaidaGroup,
    handleSubgroupChange,
    displayValue,
    handleCurrencyChange,
    setNumericValue,
    activePartners,
    saídaCategories,
    handleSave,
    handleLoadTemplate,
    handleSaveTemplate,
    isSubmitting,
    user
  } = useTransactionForm(initialData, defaultType, onSubmit, onClose, open, accountType);

  const isAutomated = initialData?.isAutomated || false;
  const isNewTransaction = !initialData;
  const isEntry = formData.type === "Entrada";
  const isReserveAccount = accountType === "reserve";

  const onFormSubmit = async (e: React.FormEvent, shouldKeepOpen: boolean = false) => {
    e.preventDefault();
    const shouldClose = await handleSave(shouldKeepOpen);
    if (shouldClose) setOpen(false);
  };

  const partnerNameForUI = formData.category === "Saque de Lucro" && formData.partnerId
    ? activePartners.find(p => p.id === formData.partnerId)?.name
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] bg-card text-card-foreground border-border max-h-[calc(100vh-10px)] overflow-y-auto my-[5px]">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-2 pr-4">
            <div>
              <DialogTitle className="text-xl font-bold">
                {initialData ? (isAutomated ? "Visualizar Transação" : "Editar Transação") : `Nova ${formData.type} ${isReserveAccount ? "(Fundo)" : ""}`}
              </DialogTitle>
              <DialogDescription>
                Informe os detalhes do lançamento financeiro.
              </DialogDescription>
            </div>
            
            {isNewTransaction && formData.type === "Saída" && !isReserveAccount && (
                <div className="flex space-x-2">
                    <CalculatorDialog
                      onCopy={setNumericValue}
                      trigger={<Button type="button" variant="outline" size="sm" className="h-8 text-orange-500 border-orange-500 hover:bg-orange-900/20"><CalcIcon className="w-4 h-4 mr-1" />Calculadora</Button>}
                    />
                    <TransactionTemplateDialog
                        onTemplateSelect={handleLoadTemplate}
                        trigger={<Button type="button" variant="outline" size="sm" className="h-8 text-blue-500 border-blue-500 hover:bg-blue-900/20"><FolderOpen className="w-4 h-4 mr-1" />Carregar</Button>}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSaveTemplate}
                        disabled={!formData.category || !formData.cleanDescription.trim()}
                        className="h-8 text-green-500 border-green-500 hover:bg-green-900/20"
                    >
                        <Save className="w-4 h-4 mr-1" />Salvar
                    </Button>
                </div>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={(e) => onFormSubmit(e, false)} className="grid gap-4 py-4">
          {isEntry ? (
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData(p => ({ ...p, category: v, cleanDescription: (v === "Fundo de Caixa" || v === "Aporte Fundo") ? "" : v }))}>
                <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {(isReserveAccount ? subcategories.Reserve.Entrada : subcategories.Entrada).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            isReserveAccount ? (
                <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData(p => ({ ...p, category: v, cleanDescription: v === "Resgate Fundo" ? "" : v }))}>
                        <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {subcategories.Reserve.Saida.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : (
                <SaidaSubgroupFields
                    activeGroup={activeSaidaGroup}
                    onGroupChange={handleSubgroupChange}
                    category={formData.category}
                    onCategoryChange={(v) => setFormData(p => ({ ...p, category: v, cleanDescription: (v === "Saque de Lucro" || v === "Fundo de Caixa") ? "" : v }))}
                    partnerId={formData.partnerId}
                    onPartnerChange={(v) => setFormData(p => ({ ...p, partnerId: v }))}
                    saídaCategories={saídaCategories}
                    activePartners={activePartners}
                    disabled={isAutomated}
                />
            )
          )}

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <DescriptionAutocomplete
                userId={user?.id}
                type={formData.type}
                category={formData.category}
                value={formData.cleanDescription}
                onChange={(val) => setFormData(p => ({ ...p, cleanDescription: val }))}
                activePartners={activePartners}
                placeholder={formData.category === "Saque de Lucro" ? `Ex: Pró-labore (prefixo ${partnerNameForUI || "Sócio"})` : (formData.category === "Fundo de Caixa" || formData.category === "Aporte Fundo" || formData.category === "Resgate Fundo") ? "Ex: Reserva de Emergência" : "Descrição"}
                disabled={isAutomated}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Valor (R$) *</Label><Input value={`R$ ${displayValue}`} onChange={handleCurrencyChange} required className="bg-input" disabled={isAutomated} /></div>
            <div className="space-y-2"><Label>Data *</Label><DatePicker date={formData.date} setDate={(d) => d && setFormData(p => ({ ...p, date: d }))} disabled={isAutomated} /></div>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento *</Label>
            <Select value={formData.paymentMethod} onValueChange={(v: PaymentMethod) => setFormData(p => ({ ...p, paymentMethod: v }))} disabled={isAutomated}>
              <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Parcelado">Parcelado</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2"><Label>Observações</Label><Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} className="bg-input" /></div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            {isNewTransaction && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={(e) => onFormSubmit(e, true)}
                className={cn("flex-1", isEntry ? "border-green-600 text-green-600 hover:bg-green-600/10" : "border-red-600 text-red-600 hover:bg-red-600/10")}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                Salvar e Nova
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn("flex-1", isEntry ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white")}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (initialData ? (isAutomated ? "Fechar" : "Salvar Alterações") : `Salvar ${formData.type}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionFormDialog;