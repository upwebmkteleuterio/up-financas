import { useState, useMemo, useCallback } from "react";
import { MarketingInvestment, AssociatedSale } from "@/types/finance";
import { parseISO, isSameMonth, startOfMonth, endOfMonth, addMonths, isWithinInterval, subMonths } from "date-fns";
import { FilterPeriod } from "@/components/FilterDropdown";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";
import { createLocalDateFromISO } from "@/lib/utils"; // Importando a nova função

const TABLE_NAME = "marketing_investments";
const QUERY_KEY = [TABLE_NAME];

export function useMarketing() {
  const { user } = useAuth();
  
  // Query para buscar todos os investimentos de marketing
  const { data: investments = [], isLoading: isLoadingInvestments } = useSupabaseQuery<MarketingInvestment>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user
  );

  // Mutações
  const { insert, update, remove } = useSupabaseMutation<MarketingInvestment, Omit<MarketingInvestment, "id">>(
    TABLE_NAME,
    QUERY_KEY
  );

  const addInvestment = useCallback((newInvestment: Omit<MarketingInvestment, "id">) => {
    // O Supabase irá gerar o ID e o user_id.
    insert.mutate(newInvestment);
  }, [insert]);
  
  const updateInvestment = useCallback((updatedInvestment: MarketingInvestment) => {
    update.mutate(updatedInvestment);
  }, [update]);

  const deleteInvestment = useCallback((id: string) => {
    remove.mutate(id);
  }, [remove]);
  
  // Marca uma venda associada como lançada no painel de contratos
  const markSaleAsContractLaunched = useCallback((
    investmentId: string, 
    associatedSaleId: string, 
    contractId: string
  ) => {
    const investment = investments.find(i => i.id === investmentId);
    if (!investment) return;

    const updatedSales = investment.associatedSales.map(sale => {
        if (sale.id === associatedSaleId) {
            return { ...sale, contractId };
        }
        return sale;
    });
    
    const updatedInvestment = { ...investment, associatedSales: updatedSales };
    
    // Atualiza o investimento no Supabase
    update.mutate(updatedInvestment);
    
  }, [investments, update]);

  // Função de filtragem principal
  const filterInvestments = useCallback((
    dateFilter: FilterPeriod,
    customDateRange: { start: Date | undefined; end: Date | undefined }
  ) => {
    let list = investments;

    // 1. Filtragem por Data (Baseado na data do investimento)
    let filterInterval: { start: Date; end: Date } | null = null;
    const now = new Date();

    if (dateFilter === "current_month") {
      filterInterval = { start: startOfMonth(now), end: endOfMonth(now) };
    } else if (dateFilter === "last_month") {
      const lastMonth = subMonths(now, 1);
      filterInterval = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    } else if (dateFilter === "custom" && customDateRange.start && customDateRange.end) {
      // Garantir que a data final inclua o dia inteiro
      const endDate = new Date(customDateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filterInterval = { start: customDateRange.start, end: endDate };
    }

    if (filterInterval) {
      list = list.filter((i) => {
        // Adicionando verificação de data
        if (!i.date) return false; 
        
        // CORREÇÃO: Usar createLocalDateFromISO
        const investmentDate = createLocalDateFromISO(i.date);
        return isWithinInterval(investmentDate, filterInterval!);
      });
    }

    // Ordena por data (mais recente primeiro)
    return [...list].sort((a, b) => {
        // CORREÇÃO: Usar createLocalDateFromISO
        const dateA = a.date ? createLocalDateFromISO(a.date).getTime() : 0;
        const dateB = b.date ? createLocalDateFromISO(b.date).getTime() : 0;
        return dateB - dateA;
    });
  }, [investments]);


  // Resumo calculado sobre TODOS os investimentos (para métricas gerais)
  const summary = useMemo(() => {
    const now = new Date();
    
    // Filtra apenas investimentos com data válida para o mês atual
    const currentMonthInvestments = investments.filter(i => 
        // CORREÇÃO: Usar createLocalDateFromISO
        i.date && isSameMonth(createLocalDateFromISO(i.date), now)
    );
    
    const totalInvestmentCurrentMonth = currentMonthInvestments.reduce((sum, i) => sum + i.investmentValue, 0);
    
    // Cálculo de métricas gerais (baseado em TODOS os dados)
    const totalInvestment = investments.reduce((sum, i) => sum + i.investmentValue, 0);
    const totalLeads = investments.reduce((sum, i) => sum + (i.leads || 0), 0);
    
    const allSales = investments.flatMap(i => i.associatedSales);
    const totalSalesValue = allSales.reduce((sum, s) => sum + s.saleValue, 0);
    const totalClients = allSales.length;

    // Custo por Lead (CPL) e Custo por Aquisição (CPA)
    const averageCPL = totalLeads > 0 ? totalInvestment / totalLeads : 0;
    const averageCPA = totalClients > 0 ? totalInvestment / totalClients : 0;
    
    // Ticket Médio
    const averageTicket = totalClients > 0 ? totalSalesValue / totalClients : 0;

    return {
      totalInvestmentCurrentMonth,
      totalInvestment,
      totalLeads,
      totalClients,
      totalSalesValue,
      averageCPL,
      averageCPA,
      averageTicket,
    };
  }, [investments]);

  return {
    investments,
    isLoadingInvestments,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    filterInvestments,
    markSaleAsContractLaunched,
    summary,
  };
}