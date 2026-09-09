"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Transaction, TransactionType, PaymentMethod, subcategories, AccountType } from "@/types/finance";
import { useToast } from "@/components/ui/use-toast";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { parseISO, format, subDays } from "date-fns";
import { useCosts } from "@/hooks/useCosts";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { usePartners } from "@/hooks/usePartners";
import { useTransactionTemplates, TransactionTemplate } from "@/hooks/useTransactionTemplates";
import { showSuccess } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY_DATE = "upweb_last_tx_date";

export type SaidaGroup = "Custo" | "Gasto" | "SaqueLucro" | "FundoCaixa";

const getTodayAtMidnight = (): Date => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
};

const getLastSavedDate = (): Date => {
    const saved = localStorage.getItem(STORAGE_KEY_DATE);
    if (saved) {
        try {
            const parsedDate = parseISO(saved);
            const today = new Date();
            
            // Se a data salva for de um mês ou ano diferente de hoje,
            // ou for mais antiga que 24h, resetamos para hoje para evitar erros.
            if (parsedDate.getMonth() !== today.getMonth() ||
                parsedDate.getFullYear() !== today.getFullYear()) {
                return getTodayAtMidnight();
            }
            
            return parsedDate;
        } catch (e) {
            return getTodayAtMidnight();
        }
    }
    return getTodayAtMidnight();
};

export interface TransactionFormState extends Omit<Transaction, "id" | "date" | "value" | "category" | "partnerId"> {
  date: Date;
  category: string;
  partnerId?: string;
  cleanDescription: string;
  accountType: AccountType;
  isTransfer?: boolean;
}

const determineSaidaGroup = (category: string, saidaCategories: { Custos: string[], Gastos: string[], SaqueLucro: string[], FundoCaixa: string[] }): SaidaGroup | undefined => {
    if (saidaCategories.Custos.includes(category)) return "Custo";
    if (saidaCategories.Gastos.includes(category)) return "Gasto";
    if (saidaCategories.SaqueLucro.includes(category)) return "SaqueLucro";
    if (saidaCategories.FundoCaixa.includes(category)) return "FundoCaixa";
    return undefined;
};

const getInitialFormState = (initialData?: Transaction, defaultType?: TransactionType, activePartners?: any[], defaultAccountType: AccountType = "main"): TransactionFormState => {
  const type = initialData?.type || defaultType || "Entrada";
  const accountType = initialData?.accountType || defaultAccountType;
  
  if (initialData) {
    let cleanDescription = initialData.description;
    if (initialData.category === "Saque de Lucro" && initialData.partnerId && activePartners) {
        const partnerName = activePartners.find((p: any) => p.id === initialData.partnerId)?.name;
        if (partnerName) {
            const prefix = `${partnerName} - `;
            if (initialData.description.startsWith(prefix)) {
                cleanDescription = initialData.description.substring(prefix.length);
            } else if (initialData.description === partnerName) {
                cleanDescription = "";
            }
        }
    }
    
    return {
      type: initialData.type,
      category: initialData.category,
      description: initialData.description,
      cleanDescription: cleanDescription,
      date: parseISO(initialData.date),
      paymentMethod: initialData.paymentMethod,
      notes: initialData.notes || "",
      partnerId: initialData.partnerId,
      accountType: accountType,
      isTransfer: initialData.isTransfer,
    };
  }
  
  return {
    type: type,
    category: type === "Entrada" ? (accountType === "main" ? subcategories.Entrada[0] : subcategories.Reserve.Entrada[0]) : "",
    description: "",
    cleanDescription: "",
    date: getLastSavedDate(),
    paymentMethod: "Pix",
    notes: "",
    partnerId: undefined,
    accountType: accountType,
    isTransfer: false,
  };
};

export function useTransactionForm(
    initialData?: Transaction,
    defaultType?: TransactionType,
    onSubmit?: (transaction: Omit<Transaction, "id">, id?: string) => void,
    onClose?: () => void,
    isOpen: boolean = false,
    defaultAccountType: AccountType = "main"
) {
  const { user } = useAuth();
  const { costCategories } = useCosts();
  const { expenseCategories } = useExpenseCategories();
  const { partners } = usePartners();
  const { addTemplate } = useTransactionTemplates();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<TransactionFormState>(getInitialFormState(initialData, defaultType, partners, defaultAccountType));
  const [activeSaidaGroup, setActiveSaidaGroup] = useState<SaidaGroup | undefined>(undefined);

  const { displayValue, numericValue, handleChange: handleCurrencyChange, setNumericValue } = useCurrencyInput(initialData ? initialData.value : 0);

  const activeCostCategoryNames = useMemo(() => costCategories.filter(c => c.isActive).map(c => c.name), [costCategories]);
  const expenseCategoryNames = useMemo(() => expenseCategories.map(c => c.name), [expenseCategories]);
  const activePartners = useMemo(() => partners.filter(p => p.isActive), [partners]);

  const saídaCategories = useMemo(() => ({
    Custos: activeCostCategoryNames,
    Gastos: expenseCategoryNames,
    SaqueLucro: ["Saque de Lucro"],
    FundoCaixa: ["Fundo de Caixa"],
  }), [activeCostCategoryNames, expenseCategoryNames]);

  const resetForm = useCallback(() => {
    const freshState = getInitialFormState(undefined, defaultType || formData.type, partners, defaultAccountType);
    setFormData(freshState);
    setNumericValue(0);
    
    if (freshState.type === "Saída") {
      if (defaultAccountType === "main") {
        const defaultGroup = activeCostCategoryNames.length > 0 ? "Custo" : expenseCategoryNames.length > 0 ? "Gasto" : "SaqueLucro";
        setActiveSaidaGroup(defaultGroup as SaidaGroup);
        
        let initialCat = "";
        if (defaultGroup === "Custo") initialCat = activeCostCategoryNames[0];
        else if (defaultGroup === "Gasto") initialCat = expenseCategoryNames[0];
        else if (defaultGroup === "SaqueLucro") initialCat = "Saque de Lucro";
        else initialCat = "Fundo de Caixa";
        
        setFormData(prev => ({
          ...prev,
          category: initialCat,
          cleanDescription: (initialCat === "Saque de Lucro" || initialCat === "Fundo de Caixa") ? "" : initialCat
        }));
      } else {
        // Reserve account always has category select instead of subgroups
        setFormData(prev => ({
          ...prev,
          category: subcategories.Reserve.Saida[0],
          cleanDescription: ""
        }));
      }
    } else {
      setActiveSaidaGroup(undefined);
    }
  }, [defaultType, formData.type, partners, activeCostCategoryNames, expenseCategoryNames, setNumericValue, defaultAccountType]);

  useEffect(() => {
    if (!isOpen) {
      if (onClose) onClose();
    } else if (!initialData) {
      resetForm();
    } else {
      const initial = getInitialFormState(initialData, defaultType, partners, defaultAccountType);
      setFormData(initial);
      setNumericValue(initialData.value);
      if (initial.type === "Saída" && defaultAccountType === "main") {
        setActiveSaidaGroup(determineSaidaGroup(initial.category, saídaCategories));
      }
    }
  }, [isOpen, initialData, defaultType, partners, saídaCategories, setNumericValue, resetForm, onClose, defaultAccountType]);

  const handleSubgroupChange = useCallback((group: SaidaGroup) => {
    if (initialData?.isAutomated) return;
    setActiveSaidaGroup(group);

    let cat = "";
    let pId = undefined;

    if (group === "Custo") cat = saídaCategories.Custos[0] || "";
    else if (group === "Gasto") cat = saídaCategories.Gastos[0] || "";
    else if (group === "SaqueLucro") {
      cat = "Saque de Lucro";
      if (activePartners.length > 0) pId = activePartners[0].id;
    } else {
      cat = "Fundo de Caixa";
    }
    
    setFormData(prev => ({
        ...prev,
        category: cat,
        partnerId: pId,
        cleanDescription: (cat === "Saque de Lucro" || cat === "Fundo de Caixa") ? "" : cat,
    }));

    if (group === "Custo" && cat) {
        const costCat = costCategories.find(c => c.name === cat);
        if (costCat && costCat.type === "Fixo" && costCat.value !== undefined) {
            setNumericValue(costCat.value);
        }
    }
  }, [initialData, saídaCategories, activePartners, costCategories, setNumericValue]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (shouldKeepOpen: boolean = false) => {
    if (numericValue <= 0) {
      toast({ title: "Erro de Validação", description: "O valor deve ser maior que zero.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      localStorage.setItem(STORAGE_KEY_DATE, formData.date.toISOString());

      const partnerName = formData.category === "Saque de Lucro" && formData.partnerId
        ? activePartners.find(p => p.id === formData.partnerId)?.name
        : null;

      let finalDescription = formData.cleanDescription.trim();
      if (formData.category === "Saque de Lucro" && partnerName) {
          finalDescription = finalDescription ? `${partnerName} - ${finalDescription}` : partnerName;
      } else if (!finalDescription) {
          finalDescription = formData.category;
      }

      const payload: Omit<Transaction, "id"> = {
          type: formData.type,
          category: formData.category,
          description: finalDescription,
          value: numericValue,
          date: formData.date.toISOString().split("T")[0],
          paymentMethod: formData.paymentMethod,
          notes: formData.notes,
          partnerId: formData.partnerId,
          accountType: formData.accountType,
          isTransfer: formData.isTransfer || formData.category === "Fundo de Caixa" || formData.category === "Aporte Fundo" || formData.category === "Resgate Fundo",
      };

      if (onSubmit) {
        await onSubmit(payload, initialData?.id);
      }

      if (shouldKeepOpen) {
        resetForm();
      }
      
      return !shouldKeepOpen; // Retorna true se deve fechar o modal
    } catch (e) {
      // Erro já tratado no hook useFinance
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadTemplate = (template: TransactionTemplate) => {
      const group = determineSaidaGroup(template.category, saídaCategories);
      if (!group) return;
      setActiveSaidaGroup(group);
      setFormData(prev => ({
          ...prev,
          type: "Saída",
          category: template.category,
          partnerId: template.partnerId,
          cleanDescription: template.cleanDescription,
      }));
  };

  const handleSaveTemplate = () => {
    if (!formData.category || !formData.cleanDescription.trim()) return;
    addTemplate({ 
        category: formData.category, 
        partnerId: formData.partnerId, 
        cleanDescription: formData.cleanDescription.trim() || formData.category 
    });
    showSuccess("Template salvo!");
  };

  return {
    formData,
    setFormData,
    activeSaidaGroup,
    handleSubgroupChange,
    displayValue,
    numericValue,
    handleCurrencyChange,
    setNumericValue,
    activePartners,
    saídaCategories,
    handleSave,
    handleLoadTemplate,
    handleSaveTemplate,
    isSubmitting,
    user
  };
}