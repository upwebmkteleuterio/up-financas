import { useState, useEffect, useMemo, useCallback } from "react";
import { useSales } from "./useSales";
import { useFinance } from "./use-finance";
import { Transaction } from "@/types/finance";
import { createLocalDateFromISO, keysToSnakeCase } from "@/lib/utils";
import { parseISO, startOfDay, isSameMonth } from "date-fns";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

export interface VirtualItem {
  id: string;
  externalId: string;
  description: string;
  value: number;
  date: string;
  profitPercentage: number;
  fundPercentage: number;
  isBalanceEntry?: boolean;
}

export interface ProfitSettings {
  globalProfitPercentage: number;
  globalFundPercentage: number;
}

const TABLE_ITEMS = "virtual_calculation_items";
const TABLE_SETTINGS = "profit_distribution_settings";

export function useProfitDistribution() {
  const { user } = useAuth();
  const { contracts } = useSales();
  const { allTransactions } = useFinance();
  const queryClient = useQueryClient();

  const currentMonthLançamentos = useMemo(() => {
    const now = new Date();
    const list: any[] = [];

    contracts.forEach(contract => {
        if (contract.isCanceled) return;
        
        contract.installments.forEach((installment) => {
            if (installment.dueDate && isSameMonth(createLocalDateFromISO(installment.dueDate), now)) {
                list.push({
                    ...installment,
                    contractId: contract.id,
                    clientName: contract.clientName,
                    service: contract.service,
                });
            }
        });
    });

    return list.sort((a, b) => {
        const dateA = createLocalDateFromISO(a.dueDate).getTime();
        const dateB = createLocalDateFromISO(b.dueDate).getTime();
        return dateB - dateA;
    });
  }, [contracts]);

  const { data: dbItems = [], refetch: refetchItems } = useSupabaseQuery<any>(
    TABLE_ITEMS,
    [TABLE_ITEMS],
    "*",
    !!user,
    undefined,
    undefined,
    undefined,
    "created_at",
    true
  );

  // CORREÇÃO: Definindo updated_at como coluna de ordenação para evitar o erro 400
  const { data: dbSettings } = useSupabaseQuery<any>(
    TABLE_SETTINGS,
    [TABLE_SETTINGS],
    "*",
    !!user,
    [],
    undefined,
    undefined,
    "updated_at", 
    false
  );

  const { insert: insertItem, remove: removeItem, update: updateItem } = useSupabaseMutation(TABLE_ITEMS, [TABLE_ITEMS]);

  const calculationList = useMemo(() => {
    return dbItems.map(item => ({
      id: item.id,
      externalId: item.externalId,
      description: item.description,
      value: Number(item.value),
      date: item.date,
      profitPercentage: Number(item.profitPercentage),
      fundPercentage: Number(item.fundPercentage),
      isBalanceEntry: item.isBalanceEntry
    })) as VirtualItem[];
  }, [dbItems]);

  const settings: ProfitSettings = useMemo(() => {
    if (dbSettings && dbSettings.length > 0) {
      const s = dbSettings[0];
      return {
        globalProfitPercentage: Number(s.globalProfitPercentage),
        globalFundPercentage: Number(s.globalFundPercentage)
      };
    }
    return { globalProfitPercentage: 30, globalFundPercentage: 70 };
  }, [dbSettings]);

  const updateSettings = async (newSettings: ProfitSettings) => {
    if (!user) return;
    const payload = keysToSnakeCase({
        user_id: user.id,
        global_profit_percentage: newSettings.globalProfitPercentage,
        global_fund_percentage: newSettings.globalFundPercentage,
        updated_at: new Date().toISOString()
    });
    const { error } = await supabase.from(TABLE_SETTINGS).upsert(payload);
    if (!error) queryClient.invalidateQueries({ queryKey: [TABLE_SETTINGS] });
  };

  const addToCalculation = (recebimento: any) => {
    if (calculationList.some(item => item.externalId === recebimento.id)) return;
    insertItem.mutate({
      user_id: user?.id,
      external_id: recebimento.id,
      description: `${recebimento.clientName} - ${recebimento.service}`,
      value: recebimento.value,
      date: recebimento.dueDate,
      profit_percentage: settings.globalProfitPercentage,
      fund_percentage: settings.globalFundPercentage,
      is_balance_entry: false
    });
  };

  const addManualEntry = (description: string, value: number) => {
    insertItem.mutate({
      user_id: user?.id,
      external_id: `manual-${Date.now()}`,
      description: description,
      value: value,
      date: new Date().toISOString().split('T')[0],
      profit_percentage: settings.globalProfitPercentage,
      fund_percentage: settings.globalFundPercentage,
      is_balance_entry: false
    });
  };

  const launchCurrentBalance = (currentBalance: number) => {
    insertItem.mutate({
      user_id: user?.id,
      external_id: `balance-${Date.now()}`,
      description: "Saldo Atual em Conta",
      value: currentBalance,
      date: new Date().toISOString().split('T')[0],
      profit_percentage: settings.globalProfitPercentage,
      fund_percentage: settings.globalFundPercentage,
      is_balance_entry: true
    });
  };

  const removeFromCalculation = (id: string) => removeItem.mutate(id);
  const updateItemPercentages = (id: string, profit: number, fund: number) => {
    updateItem.mutate({ id, profit_percentage: profit, fund_percentage: fund });
  };

  const clearList = async () => {
    if (!user) return;
    const { error } = await supabase.from(TABLE_ITEMS).delete().eq('user_id', user.id);
    if (!error) refetchItems();
  };

  const kpis = useMemo(() => {
    if (calculationList.length === 0) return { totalProfit: 0, totalFund: 0, availableProfit: 0, availableFund: 0, spentSinceOldest: 0, saquesDeLucro: 0, outrosGastos: 0 };
    const totalProfit = calculationList.reduce((acc, item) => acc + (item.value * (item.profitPercentage / 100)), 0);
    const totalFund = calculationList.reduce((acc, item) => acc + (item.value * (item.fundPercentage / 100)), 0);
    
    const oldestDate = calculationList.reduce((oldest, item) => {
      const itemDate = parseISO(item.date);
      return itemDate < oldest ? itemDate : oldest;
    }, parseISO(calculationList[0].date));
    
    const outputsSince = allTransactions.filter(t => {
      if (t.type !== "Saída") return false;
      const tDate = startOfDay(parseISO(t.date));
      const refDate = startOfDay(oldestDate);
      return tDate >= refDate;
    });
    
    const totalSpent = outputsSince.reduce((acc, t) => acc + t.value, 0);
    const saquesDeLucro = outputsSince.filter(t => t.category === "Saque de Lucro").reduce((acc, t) => acc + t.value, 0);
    const outrosGastos = totalSpent - saquesDeLucro;
    
    return { totalProfit, totalFund, availableProfit: totalProfit - saquesDeLucro, availableFund: totalFund - outrosGastos, spentSinceOldest: totalSpent, saquesDeLucro, outrosGastos };
  }, [calculationList, allTransactions]);

  return {
    lançamentos: currentMonthLançamentos,
    calculationList,
    settings,
    updateSettings,
    addToCalculation,
    addManualEntry,
    removeFromCalculation,
    updateItemPercentages,
    clearList,
    launchCurrentBalance,
    kpis
  };
}