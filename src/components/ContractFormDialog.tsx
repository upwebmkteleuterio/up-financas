"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
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
import { Contract, ContractType, ContractInstallment } from "@/types/finance";
import { useToast } from "@/components/ui/use-toast";
import { DatePicker } from "./DatePicker";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { parseISO, format, addMonths, setDate } from "date-fns";
import { Plus, Minus, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createLocalDateFromISO } from "@/lib/utils";
import { useServices } from "@/hooks/useServices";

const maskPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  } else {
    return cleaned
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  }
};

const genInstallmentId = () => Date.now().toString() + Math.random().toString(36).substring(2, 9);

const formatNumericValueToDisplay = (value: number): string => {
    const digits = Math.round(value * 100).toString();
    if (!digits) return "0,00";
    let cleanedDigits = digits.replace(/^0+/, "");
    if (cleanedDigits === "") cleanedDigits = "0";
    while (cleanedDigits.length < 3) {
        cleanedDigits = "0" + cleanedDigits;
    }
    const cents = cleanedDigits.slice(-2);
    let reals = cleanedDigits.slice(0, -2);
    if (reals === "") {
        reals = "0";
    }
    let formattedReals = "";
    for (let i = reals.length - 1, count = 0; i >= 0; i--, count++) {
        formattedReals = reals[i] + formattedReals;
        if (count % 3 === 2 && i !== 0) {
            formattedReals = "." + formattedReals;
        }
    }
    return `${formattedReals},${cents}`;
};

interface FormInstallment {
    id: string;
    value: number;
    date: Date;
    isPaid?: boolean;
    paidValue?: number;
    paidDate?: string;
}

interface FormState extends Omit<Contract, "id" | "totalContractValue" | "installments" | "isRecurrenceValueFixed" | "dateClosed"> {
    contractType: ContractType;
    dateClosed: Date; 
    installments: FormInstallment[];
    recurrenceInstallmentCount: number;
    isRecurrenceValueFixed: boolean;
    fixedRecurrenceValue: number; 
    fixedRecurrenceDate: Date;
    firstRecurrenceValue: number;
    firstRecurrenceDate: Date;
    otherRecurrenceValue: number;
    otherRecurrenceDueDay: number;
}

interface PartialInitialData {
    clientName?: string;
    dateClosed?: Date;
}

const getInitialFormState = (initialData?: Contract, partialData?: PartialInitialData, defaultService?: string): FormState => {
    let initialFixedRecurrenceDate = createLocalDateFromISO(format(new Date(), 'yyyy-MM-dd'));
    let initialFirstRecurrenceDate = createLocalDateFromISO(format(new Date(), 'yyyy-MM-dd'));
    let initialOtherRecurrenceDueDay = new Date().getDate();
    let initialDateClosed = createLocalDateFromISO(format(new Date(), 'yyyy-MM-dd'));
    let initialClientName = "";

    if (initialData) {
        const installments = (initialData.installments || []).map(i => ({
            id: i.id,
            value: i.value,
            date: createLocalDateFromISO(i.dueDate),
            isPaid: i.isPaid,
            paidValue: i.paidValue,
            paidDate: i.paidDate,
        }));
        
        initialDateClosed = createLocalDateFromISO(initialData.dateClosed);
        initialClientName = initialData.clientName;

        let recurrenceInstallmentCount = 1;
        let fixedRecurrenceValue = 0;
        let firstRecurrenceValue = 0;
        let otherRecurrenceValue = 0;

        if (initialData.contractType === "Recorrente") {
            recurrenceInstallmentCount = installments.length;
            if (initialData.isRecurrenceValueFixed) {
                fixedRecurrenceValue = installments[0]?.value || 0;
                initialFixedRecurrenceDate = installments[0]?.date || createLocalDateFromISO(format(new Date(), 'yyyy-MM-dd'));
            } else {
                firstRecurrenceValue = installments[0]?.value || 0;
                initialFirstRecurrenceDate = installments[0]?.date || createLocalDateFromISO(format(new Date(), 'yyyy-MM-dd'));
                otherRecurrenceValue = installments[1]?.value || installments[0]?.value || 0;
                if (installments.length > 1) {
                    initialOtherRecurrenceDueDay = installments[1].date.getDate();
                }
            }
        }
        
        return {
            clientName: initialClientName,
            service: initialData.service,
            phone: initialData.phone,
            notes: initialData.notes || "",
            contractType: initialData.contractType,
            launchFinancialEntry: initialData.launchFinancialEntry,
            dateClosed: initialDateClosed,
            installments,
            recurrenceInstallmentCount,
            isRecurrenceValueFixed: initialData.isRecurrenceValueFixed || false,
            fixedRecurrenceValue,
            fixedRecurrenceDate: initialFixedRecurrenceDate,
            firstRecurrenceValue,
            firstRecurrenceDate: initialFirstRecurrenceDate,
            otherRecurrenceValue,
            otherRecurrenceDueDay: initialOtherRecurrenceDueDay,
            isCanceled: initialData.isCanceled || false,
        };
    }
    
    const today = createLocalDateFromISO(format(new Date(), 'yyyy-MM-dd'));
    
    return {
        clientName: partialData?.clientName || "",
        service: defaultService || "",
        phone: "",
        notes: "",
        contractType: "Fixo",
        launchFinancialEntry: false,
        dateClosed: partialData?.dateClosed ? createLocalDateFromISO(format(partialData.dateClosed, 'yyyy-MM-dd')) : today,
        installments: [{ id: genInstallmentId(), value: 0, date: partialData?.dateClosed ? createLocalDateFromISO(format(partialData.dateClosed, 'yyyy-MM-dd')) : today, isPaid: false }],
        recurrenceInstallmentCount: 3,
        isRecurrenceValueFixed: true,
        fixedRecurrenceValue: 0,
        fixedRecurrenceDate: partialData?.dateClosed ? createLocalDateFromISO(format(partialData.dateClosed, 'yyyy-MM-dd')) : today,
        firstRecurrenceValue: 0,
        firstRecurrenceDate: partialData?.dateClosed ? createLocalDateFromISO(format(partialData.dateClosed, 'yyyy-MM-dd')) : today,
        otherRecurrenceValue: 0,
        otherRecurrenceDueDay: today.getDate(),
        isCanceled: false,
    };
};

interface ContractFormDialogProps {
    trigger: React.ReactNode;
    initialData?: Contract;
    partialInitialData?: PartialInitialData; 
    onContractLaunched?: (contractId: string) => void; 
    onSubmit: (contract: Omit<Contract, "id">, id?: string) => void;
    onClose?: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}


const ContractFormDialog: React.FC<ContractFormDialogProps> = ({ 
    trigger, 
    initialData, 
    partialInitialData, 
    onSubmit, 
    onClose,
    open, 
    onOpenChange, 
}) => {
  const { serviceCategories, isLoadingServices } = useServices();
  const [formData, setFormData] = useState<FormState>(getInitialFormState(initialData, partialInitialData, serviceCategories[0]?.name));
  const { toast } = useToast();

  const fixedValueHook = useCurrencyInput(formData.contractType === "Fixo" ? formData.installments[0]?.value || 0 : 0);
  const fixedRecurrenceValueHook = useCurrencyInput(formData.fixedRecurrenceValue);
  const firstRecurrenceValueHook = useCurrencyInput(formData.firstRecurrenceValue);
  const otherRecurrenceValueHook = useCurrencyInput(formData.otherRecurrenceValue);
  
  const daysOfMonth = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  useEffect(() => {
    if (open) {
        const initial = getInitialFormState(initialData, partialInitialData, serviceCategories[0]?.name);
        setFormData(initial);
        fixedValueHook.setNumericValue(initial.contractType === "Fixo" ? initial.installments[0]?.value || 0 : 0);
        fixedRecurrenceValueHook.setNumericValue(initial.fixedRecurrenceValue);
        firstRecurrenceValueHook.setNumericValue(initial.firstRecurrenceValue);
        otherRecurrenceValueHook.setNumericValue(initial.otherRecurrenceValue);
    } else if (onClose) {
        onClose();
    }
  }, [open, initialData, partialInitialData, onClose, serviceCategories]);

  const handleBaseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    if (id === "phone") {
        const maskedValue = maskPhone(value);
        setFormData((prev) => ({ ...prev, [id]: maskedValue }));
    } else if (id !== "value") {
        setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };
  
  const handleDateClosedChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => {
        const localDate = createLocalDateFromISO(format(date, 'yyyy-MM-dd'));
        const newState = { ...prev, dateClosed: localDate };
        if (newState.contractType === "Fixo" && newState.installments.length > 0) {
            newState.installments = newState.installments.map((i, index) => index === 0 ? { ...i, date: localDate } : i);
        }
        return newState;
      });
    }
  };

  const handleSelectChange = (id: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value as any }));
  };
  
  const handleRecurrenceCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10);
    setFormData((prev) => ({ ...prev, recurrenceInstallmentCount: isNaN(count) || count < 1 ? 1 : count }));
  };
  
  const handleOtherRecurrenceDueDayChange = (dayString: string) => {
    const day = parseInt(dayString, 10);
    setFormData((prev) => ({ ...prev, otherRecurrenceDueDay: isNaN(day) ? new Date().getDate() : day }));
  };

  const handleInstallmentValueChange = (id: string, rawValue: string) => {
    const newDigits = rawValue.replace(/\D/g, "");
    if (newDigits.length > 15) return;
    const numericValue = parseFloat(newDigits) / 100;
    setFormData((prev) => ({
      ...prev,
      installments: prev.installments.map((i) => i.id === id ? { ...i, value: numericValue } : i),
    }));
  };

  const handleInstallmentDateChange = (id: string, date: Date | undefined) => {
    if (date) {
      const localDate = createLocalDateFromISO(format(date, 'yyyy-MM-dd'));
      setFormData((prev) => ({
        ...prev,
        installments: prev.installments.map((i) => i.id === id ? { ...i, date: localDate } : i),
      }));
    }
  };

  const addInstallment = () => {
    const lastDate = formData.installments[formData.installments.length - 1]?.date || createLocalDateFromISO(format(new Date(), 'yyyy-MM-dd'));
    const nextDate = addMonths(lastDate, 1);
    setFormData((prev) => ({
      ...prev,
      installments: [...prev.installments, { id: genInstallmentId(), value: 0, date: createLocalDateFromISO(format(nextDate, 'yyyy-MM-dd')), isPaid: false }],
    }));
  };

  const removeInstallment = (id: string) => {
    if (formData.installments.length > 1) {
      setFormData((prev) => ({ ...prev, installments: prev.installments.filter((i) => i.id !== id) }));
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = formData.phone.replace(/\D/g, '');
    if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
        toast({ title: "Erro de Validação", description: "O telefone deve ter 10 ou 11 dígitos.", variant: "destructive" });
        return;
    }
    if (!formData.clientName || !formData.service) {
      toast({ title: "Erro de Validação", description: "Preencha Nome do Cliente e Serviço.", variant: "destructive" });
      return;
    }
    
    let finalInstallments: ContractInstallment[] = [];
    let totalContractValue = 0;
    let validationError = "";

    if (formData.contractType === "Fixo") {
        const value = fixedValueHook.numericValue;
        const date = formData.installments[0]?.date;
        if (value <= 0 || !date) {
            validationError = "Valor e Data são obrigatórios.";
        } else {
            // Preserva o isPaid original caso seja uma edição
            const isPaid = formData.installments[0]?.isPaid || false;
            finalInstallments = [{
                id: formData.installments[0]?.id || genInstallmentId(),
                value,
                dueDate: format(date, 'yyyy-MM-dd'),
                isPaid,
                paidValue: formData.installments[0]?.paidValue,
                paidDate: formData.installments[0]?.paidDate
            }];
            totalContractValue = value;
        }
    } else if (formData.contractType === "Parcelado") {
        const validInstallments = formData.installments.filter(i => i.value > 0 && i.date);
        if (validInstallments.length === 0) {
            validationError = "Adicione pelo menos uma parcela válida.";
        } else {
            finalInstallments = validInstallments.map(i => ({
                id: i.id,
                value: i.value,
                dueDate: format(i.date, 'yyyy-MM-dd'),
                isPaid: i.isPaid || false,
                paidValue: i.paidValue,
                paidDate: i.paidDate
            }));
            totalContractValue = finalInstallments.reduce((sum, i) => sum + i.value, 0);
        }
    } else if (formData.contractType === "Recorrente") {
        const count = formData.recurrenceInstallmentCount;
        if (count < 1) {
            validationError = "Nº de parcelas deve ser no mínimo 1.";
        } else if (formData.isRecurrenceValueFixed) {
            const value = fixedRecurrenceValueHook.numericValue;
            const firstDate = formData.fixedRecurrenceDate;
            if (value <= 0 || !firstDate) {
                validationError = "Valor e Data da 1ª Parcela são obrigatórios.";
            } else {
                for (let i = 0; i < count; i++) {
                    const dueDate = setDate(addMonths(firstDate, i), firstDate.getDate());
                    const existingInstallment = formData.installments[i];
                    finalInstallments.push({
                        id: existingInstallment?.id || genInstallmentId(),
                        value,
                        dueDate: format(dueDate, 'yyyy-MM-dd'),
                        isPaid: existingInstallment?.isPaid || false,
                        paidValue: existingInstallment?.paidValue,
                        paidDate: existingInstallment?.paidDate
                    });
                    totalContractValue += value;
                }
            }
        } else {
            const firstValue = firstRecurrenceValueHook.numericValue;
            const otherValue = otherRecurrenceValueHook.numericValue;
            const firstDate = formData.firstRecurrenceDate;
            const dueDay = formData.otherRecurrenceDueDay;
            if (firstValue <= 0 || !firstDate || (count > 1 && otherValue <= 0)) {
                validationError = "Preencha todos os valores e datas.";
            } else {
                // Primeira parcela
                const existingFirst = formData.installments[0];
                finalInstallments.push({
                    id: existingFirst?.id || genInstallmentId(),
                    value: firstValue,
                    dueDate: format(firstDate, 'yyyy-MM-dd'),
                    isPaid: existingFirst?.isPaid || false,
                    paidValue: existingFirst?.paidValue,
                    paidDate: existingFirst?.paidDate
                });
                totalContractValue += firstValue;
                let currentDate = firstDate;
                for (let i = 1; i < count; i++) {
                    let dueDate = setDate(addMonths(currentDate, 1), dueDay);
                    const existingOther = formData.installments[i];
                    finalInstallments.push({
                        id: existingOther?.id || genInstallmentId(),
                        value: otherValue,
                        dueDate: format(dueDate, 'yyyy-MM-dd'),
                        isPaid: existingOther?.isPaid || false,
                        paidValue: existingOther?.paidValue,
                        paidDate: existingOther?.paidDate
                    });
                    totalContractValue += otherValue;
                    currentDate = dueDate;
                }
            }
        }
    }

    if (validationError) {
        toast({ title: "Erro de Validação", description: validationError, variant: "destructive" });
        return;
    }
    
    const contractToSubmit: Omit<Contract, "id"> = {
        clientName: formData.clientName,
        service: formData.service,
        phone: formData.phone,
        notes: formData.notes,
        contractType: formData.contractType,
        launchFinancialEntry: formData.launchFinancialEntry,
        totalContractValue: totalContractValue,
        dateClosed: format(formData.dateClosed, 'yyyy-MM-dd'),
        installments: finalInstallments,
        isRecurrenceValueFixed: formData.contractType === "Recorrente" ? formData.isRecurrenceValueFixed : undefined,
        isCanceled: formData.isCanceled,
    };
    onSubmit(contractToSubmit, initialData?.id);
    onOpenChange(false);
  };

  const renderContractDetails = () => {
    if (formData.contractType === "Fixo") {
        return (
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fixedValue">Valor (R$) *</Label>
                    <Input id="fixedValue" value={`R$ ${fixedValueHook.displayValue}`} onChange={fixedValueHook.handleChange} required className="bg-input" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fixedDate">Data de Vencimento *</Label>
                    <DatePicker date={formData.installments[0]?.date} setDate={(date) => formData.installments[0] && handleInstallmentDateChange(formData.installments[0].id, date)} />
                </div>
            </div>
        );
    }
    if (formData.contractType === "Parcelado") {
        return (
            <div className="space-y-4">
                <Label>Parcelas *</Label>
                {formData.installments.map((installment, index) => (
                    <div key={installment.id} className="flex items-center space-x-2">
                        <span className="w-16 text-sm font-medium flex-shrink-0">{`Parcela ${index + 1}`}</span>
                        <Input value={`R$ ${formatNumericValueToDisplay(installment.value)}`} onChange={(e) => handleInstallmentValueChange(installment.id, e.target.value)} className="w-1/2 bg-input" />
                        <DatePicker date={installment.date} setDate={(date) => handleInstallmentDateChange(installment.id, date)} />
                        {formData.installments.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeInstallment(installment.id)} className="text-red-500 hover:bg-red-900/20"><Minus className="w-4 h-4" /></Button>
                        )}
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addInstallment} className="w-full mt-2"><Plus className="w-4 h-4 mr-2" /> Adicionar Parcela</Button>
            </div>
        );
    }
    if (formData.contractType === "Recorrente") {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="recurrenceCount">Nº de Parcelas *</Label><Input id="recurrenceCount" type="number" min="1" value={formData.recurrenceInstallmentCount} onChange={handleRecurrenceCountChange} className="bg-input" /></div>
                    <div className="space-y-2"><Label>Valor Fixo?</Label>
                        <Select value={formData.isRecurrenceValueFixed ? "Sim" : "Não"} onValueChange={(v) => setFormData(prev => ({ ...prev, isRecurrenceValueFixed: v === "Sim" }))}>
                            <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                        </Select>
                    </div>
                </div>
                {formData.isRecurrenceValueFixed ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="fixedRecurrenceValue">Valor Fixo (R$) *</Label><Input id="fixedRecurrenceValue" value={`R$ ${fixedRecurrenceValueHook.displayValue}`} onChange={fixedRecurrenceValueHook.handleChange} className="bg-input" /></div>
                        <div className="space-y-2"><Label htmlFor="fixedRecurrenceDate">Data 1ª Parcela *</Label><DatePicker date={formData.fixedRecurrenceDate} setDate={(d) => d && setFormData(p => ({ ...p, fixedRecurrenceDate: createLocalDateFromISO(format(d, 'yyyy-MM-dd')) }))} /></div>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <Label className="font-semibold mt-2">Detalhes Variáveis</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="firstRecurrenceValue">1ª Parcela (R$) *</Label><Input id="firstRecurrenceValue" value={`R$ ${firstRecurrenceValueHook.displayValue}`} onChange={firstRecurrenceValueHook.handleChange} className="bg-input" /></div>
                            <div className="space-y-2"><Label htmlFor="firstRecurrenceDate">Data 1ª Parcela *</Label><DatePicker date={formData.firstRecurrenceDate} setDate={(d) => d && setFormData(p => ({ ...p, firstRecurrenceDate: createLocalDateFromISO(format(d, 'yyyy-MM-dd')) }))} /></div>
                        </div>
                        {formData.recurrenceInstallmentCount > 1 && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label htmlFor="otherRecurrenceValue">Demais Parcelas (R$) *</Label><Input id="otherRecurrenceValue" value={`R$ ${otherRecurrenceValueHook.displayValue}`} onChange={otherRecurrenceValueHook.handleChange} className="bg-input" /></div>
                                <div className="space-y-2"><Label htmlFor="otherRecurrenceDueDay">Dia Vencimento *</Label>
                                    <Select value={formData.otherRecurrenceDueDay.toString()} onValueChange={handleOtherRecurrenceDueDayChange}>
                                        <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                                        <SelectContent>{daysOfMonth.map(d => <SelectItem key={d} value={d.toString()}>Dia {d}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!open && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] bg-card text-card-foreground border-border max-h-[calc(100vh-10px)] overflow-y-auto my-[5px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{initialData?.id ? "Editar Contrato" : "Registrar Contrato"}</DialogTitle>
          <DialogDescription>
            Preencha as informações do contrato para gestão de recebimentos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="clientName">Nome do Cliente *</Label><Input id="clientName" value={formData.clientName} onChange={handleBaseChange} required className="bg-input" /></div>
            <div className="space-y-2">
              <Label htmlFor="service">Serviço *</Label>
              <Select value={formData.service} onValueChange={(v) => handleSelectChange("service", v)} disabled={isLoadingServices}>
                <SelectTrigger className="bg-input">
                    {isLoadingServices ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="Selecione o Serviço" />}
                </SelectTrigger>
                <SelectContent>
                  {serviceCategories.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="phone">Telefone *</Label><Input id="phone" value={formData.phone} onChange={handleBaseChange} required className="bg-input" /></div>
            <div className="space-y-2"><Label htmlFor="contractType">Tipo Pagamento *</Label>
              <Select value={formData.contractType} onValueChange={(v: any) => handleSelectChange("contractType", v)}>
                <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Parcelado">Parcelado</SelectItem><SelectItem value="Fixo">Fixo</SelectItem><SelectItem value="Recorrente">Recorrente</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="dateClosed">Data Fechamento *</Label><DatePicker date={formData.dateClosed} setDate={handleDateClosedChange} /></div>
          {renderContractDetails()}
          <div className="space-y-2"><Label htmlFor="notes">Observações</Label><Textarea id="notes" value={formData.notes} onChange={handleBaseChange} className="bg-input" /></div>
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md mt-4">
            <Label htmlFor="launchFinancialEntry" className="text-base font-medium">Lançar 1ª Entrada?</Label>
            <Switch id="launchFinancialEntry" checked={formData.launchFinancialEntry} onCheckedChange={(c) => setFormData(p => ({ ...p, launchFinancialEntry: c }))} />
          </div>
          <Button type="submit" className="mt-4 bg-green-600 hover:bg-green-700">Salvar Contrato</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContractFormDialog;