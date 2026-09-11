import { useMemo, useCallback, useState, useEffect } from "react";
import { Transaction, Contract, CostCategory, ExpenseCategory, Partner, MarketingInvestment } from "@/types/finance";
import { parseISO, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks, format, setMonth, getYear } from "date-fns";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";
import { useCosts } from "./useCosts";
import { useSales } from "./useSales";
import { useExpenseCategories } from "./useExpenseCategories";
import { usePartners } from "./usePartners";
import { useMarketing } from "./useMarketing";
import { FilterPeriod } from "@/components/FilterDropdown";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { keysToCamelCase, createLocalDateFromISO, keysToSnakeCase } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";
import { dispatchTransactionCreated } from "@/lib/transaction-events";

const TABLE_NAME = "transactions";
const QUERY_KEY = [TABLE_NAME];
const PAGE_SIZE = 50;

// Função auxiliar para calcular o resumo de uma lista de transações
const calculateSummary = (transactions: Transaction[], allTransactions: Transaction[], costCategoryNames: string[]) => {
    // Resumo baseado APENAS nas transações fornecidas (filtradas por data, mas não paginadas)
    const totalEntradas = transactions
      .filter((t) => t.type === "Entrada" && !t.isTransfer)
      .reduce((sum, t) => sum + t.value, 0);
    
    const totalAportes = transactions
      .filter((t) => t.type === "Entrada" && t.category === "Aporte Fundo")
      .reduce((sum, t) => sum + t.value, 0);

    const totalCustos = transactions
      .filter((t) => t.type === "Saída" && costCategoryNames.includes(t.category))
      .reduce((sum, t) => sum + t.value, 0);

    const totalSaquesLucro = transactions
      .filter((t) => t.type === "Saída" && t.category === "Saque de Lucro")
      .reduce((sum, t) => sum + t.value, 0);

    const totalGastos = transactions
      .filter((t) => 
        t.type === "Saída" && 
        t.category !== "Saque de Lucro" && 
        !t.isTransfer &&
        !costCategoryNames.includes(t.category)
      )
      .reduce((sum, t) => sum + t.value, 0);
    
    const totalResgates = transactions
      .filter((t) => t.type === "Saída" && t.category === "Resgate Fundo")
      .reduce((sum, t) => sum + t.value, 0);

    // Total em Conta Principal
    const totalEmConta = allTransactions
      .filter(t => t.accountType === 'main' || !t.accountType) // Considera main por padrão
      .reduce((sum, t) => {
        if (t.type === "Entrada") return sum + t.value;
        if (t.type === "Saída") return sum - t.value;
        return sum;
    }, 0);

    // Saldo do Fundo de Caixa
    const totalFundoCaixa = allTransactions
      .filter(t => t.accountType === 'reserve')
      .reduce((sum, t) => {
        if (t.type === "Entrada") return sum + t.value;
        if (t.type === "Saída") return sum - t.value;
        return sum;
    }, 0);

    // Para compatibilidade com transações antigas (legado)
    const legacyFundoCaixa = allTransactions.reduce((sum, t) => {
        if (!t.accountType && t.category === "Fundo de Caixa") {
            if (t.type === "Saída") return sum + t.value;
            if (t.type === "Entrada") return sum - t.value;
        }
        return sum;
    }, 0);

    const adjustedFundoCaixa = totalFundoCaixa + legacyFundoCaixa;
    const totalContaComFundo = totalEmConta + adjustedFundoCaixa;

    return {
      totalEntradas,
      totalAportes,
      totalGastos,
      totalCustos,
      totalSaquesLucro,
      totalResgates,
      totalEmConta,
      totalFundoCaixa: adjustedFundoCaixa,
      totalContaComFundo,
    };
};

// --- Lógica de Filtro de Data (Reutilizável) ---
const getFilterParams = (
    dateFilter: FilterPeriod,
    customDateRange: { start: Date | undefined; end: Date | undefined }
) => {
    const now = new Date();
    let filters = [];
    let filterInterval: { start: Date; end: Date } | null = null;

    if (dateFilter === "current_month") {
        filterInterval = { start: startOfMonth(now), end: endOfMonth(now) };
    } else if (dateFilter === "last_month") {
        const lastMonth = subMonths(now, 1);
        filterInterval = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    } else if (dateFilter.startsWith("month_")) {
        const monthIndex = parseInt(dateFilter.split("_")[1]);
        const targetDate = setMonth(new Date(), monthIndex);
        filterInterval = { start: startOfMonth(targetDate), end: endOfMonth(targetDate) };
    } else if (dateFilter === "custom" && customDateRange.start && customDateRange.end) {
        const endDate = new Date(customDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        filterInterval = { start: customDateRange.start, end: endDate };
    }

    if (filterInterval) {
        filters.push({ column: 'date', operator: 'gte', value: format(filterInterval.start, 'yyyy-MM-dd') });
        filters.push({ column: 'date', operator: 'lte', value: format(filterInterval.end, 'yyyy-MM-dd') });
    }
    
    const filterKey = `${dateFilter}-${filterInterval?.start.getTime()}-${filterInterval?.end.getTime()}`;
    return { filters, filterKey };
};


// --- HOOK DE PAGINAÇÃO INFINITA OTIMIZADA ---
export function useInfiniteTransactions(
    dateFilter: FilterPeriod,
    customDateRange: { start: Date | undefined; end: Date | undefined },
    costCategoryNames: string[],
    accountType: "main" | "reserve" = "main"
) {
    const { user } = useAuth();
    const { filters, filterKey } = getFilterParams(dateFilter, customDateRange);

    // 2. Função de busca para useInfiniteQuery
    const fetcher = useCallback(async ({ pageParam = 0 }): Promise<Transaction[]> => {
        if (!user) return [];
        
        const offset = pageParam;
        
        let query: any = supabase
            .from(TABLE_NAME)
            .select("*")
            .eq("account_type", accountType) // Filtra por conta
            .order("date", { ascending: false })
            .limit(PAGE_SIZE + 1) 
            .range(offset, offset + PAGE_SIZE);

        filters.forEach(filter => {
            query = (query[filter.operator] as any)(filter.column, filter.value);
        });

        const { data, error } = await query;

        if (error) {
            console.error(`[useInfiniteTransactions] Erro ao buscar ${TABLE_NAME}:`, error);
            throw new Error(`Erro ao buscar ${TABLE_NAME}: ${error.message}`);
        }
        
        return (data as unknown as Transaction[]).map(keysToCamelCase) as Transaction[];
    }, [user, filters, accountType]);

    // 3. useInfiniteQuery
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isFetching,
    } = useInfiniteQuery({
        queryKey: [...QUERY_KEY, filterKey, 'infinite', accountType], 
        queryFn: fetcher,
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.length > PAGE_SIZE) {
                return allPages.reduce((sum, page) => sum + page.length, 0) - 1; 
            }
            return undefined; 
        },
        select: (data) => ({
            pages: data.pages.map(page => page.slice(0, PAGE_SIZE)),
            pageParams: data.pageParams,
        }),
        staleTime: 1000 * 60 * 5, 
        enabled: !!user,
    });
    
    // 4. Combina todas as páginas em uma lista única
    const transactions = useMemo(() => {
        if (!data) return [];
        return data.pages.flat();
    }, [data]);

    return {
        transactions,
        isLoading: isLoading, 
        isFetching: isFetching || isFetchingNextPage,
        hasMore: hasNextPage,
        loadMore: fetchNextPage,
    };
}
// --- FIM HOOK DE PAGINAÇÃO INFINITA OTIMIZADA ---


export function useFinance() {
  const { user } = useAuth();
  const { costCategories } = useCosts(); 
  const queryClient = useQueryClient();
  
  // Nomes das categorias de custo ativas para o cálculo do resumo
  const costCategoryNames = useMemo(() => costCategories.map(c => c.name), [costCategories]);
  
  // Query para buscar TODAS as transações (necessário para o cálculo do Total em Conta)
  const { data: allTransactions = [], isLoading: isLoadingAll } = useSupabaseQuery<Transaction>(
    TABLE_NAME,
    [...QUERY_KEY, 'all'],
    "*",
    !!user
  );
  
  // Mutações
  const { insert: insertMutation, update, remove } = useSupabaseMutation<Transaction, Omit<Transaction, "id">>(
    TABLE_NAME,
    QUERY_KEY
  );
  
  // Hooks de mutação de outros módulos (para importação)
  const { insert: insertCost } = useSupabaseMutation<CostCategory, any>("cost_categories", ["cost_categories"]);
  const { insert: insertExpense } = useSupabaseMutation<ExpenseCategory, any>("expense_categories", ["expense_categories"]);
  const { insert: insertPartner } = useSupabaseMutation<Partner, any>("partners", ["partners"]);
  const { insert: insertContract } = useSupabaseMutation<Contract, any>("contracts", ["contracts"]);
  const { insert: insertMarketing } = useSupabaseMutation<MarketingInvestment, any>("marketing_investments", ["marketing_investments"]);

  // Mutação de inserção customizada para invalidar o cache global
  const addTransaction = useCallback(async (newTransaction: Omit<Transaction, "id">) => {
    if (!user) return;

    console.log("[useFinance] Iniciando salvamento de transação:", newTransaction);

    try {
        // 1. Prepara os dados (o insertMutation já cuida do snake_case e user_id)
        const payload = {
            ...newTransaction,
            accountType: newTransaction.accountType || 'main',
            isTransfer: newTransaction.isTransfer || false
        };

        // 2. Insere a transação principal usando a mutação padrão (testada)
        const insertedData = await insertMutation.mutateAsync(payload as any);
        console.log("[useFinance] Transação principal salva com sucesso:", insertedData);

        // 3. Se for uma transferência, cria a contraparte automaticamente
        if (newTransaction.isTransfer) {
            let counterpart: Omit<Transaction, "id"> | null = null;

            // Caso A: Main -> Reserve (Aporte)
            if (newTransaction.accountType === 'main' && newTransaction.type === 'Saída' && newTransaction.category === 'Fundo de Caixa') {
                counterpart = {
                    ...newTransaction,
                    accountType: 'reserve',
                    type: 'Entrada',
                    category: 'Aporte Fundo',
                    description: `Aporte vindo da Conta Principal: ${newTransaction.description}`,
                    paymentMethod: 'Transferência'
                };
            }
            // Caso B: Reserve -> Main (Resgate)
            else if (newTransaction.accountType === 'reserve' && newTransaction.type === 'Saída' && newTransaction.category === 'Resgate Fundo') {
                counterpart = {
                    ...newTransaction,
                    accountType: 'main',
                    type: 'Entrada',
                    category: 'Fundo de Caixa',
                    description: `Resgate vindo do Fundo de Caixa: ${newTransaction.description}`,
                    paymentMethod: 'Transferência'
                };
            }
            // Caso C: Entrada direta de Aporte no Reserve -> Saída na Principal
            else if (newTransaction.accountType === 'reserve' && newTransaction.type === 'Entrada' && newTransaction.category === 'Aporte Fundo') {
                counterpart = {
                    ...newTransaction,
                    accountType: 'main',
                    type: 'Saída',
                    category: 'Fundo de Caixa',
                    description: `Aporte para Fundo de Caixa: ${newTransaction.description}`,
                    paymentMethod: 'Transferência'
                };
            }

            if (counterpart) {
                console.log("[useFinance] Criando contraparte de transferência:", counterpart);
                await insertMutation.mutateAsync({ ...counterpart, isTransfer: true } as any);
            }
        }

        dispatchTransactionCreated(insertedData.id);

        // 4. Sucesso! (O aviso showSuccess já é disparado pelo hook useSupabaseMutation se eu não tivesse sobrescrevido,
        // mas aqui eu uso o showSuccess manual para garantir a mensagem correta)
        showSuccess(`${newTransaction.type === 'Entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!`);
    } catch (err: any) {
        console.error("[useFinance] Erro fatal ao salvar transação:", err);
        // O erro já foi mostrado via toast pelo onError do useSupabaseMutation
        throw err;
    }
  }, [user, insertMutation]);
  
  const updateTransaction = useCallback((updatedTransaction: Transaction) => {
    if (updatedTransaction.isAutomated) {
      console.warn("Tentativa de editar transação automática bloqueada.");
      return;
    }
    update.mutate(updatedTransaction);
  }, [update]);

  const deleteTransaction = useCallback((id: string) => {
    remove.mutate(id);
  }, [remove]);

  const updateTransactionCategoryOnDelete = useCallback((oldCategoryName: string, newCategoryName: string) => {
    const transactionsToUpdate = allTransactions.filter(t => 
        t.type === "Saída" && t.category === oldCategoryName
    );
    
    transactionsToUpdate.forEach(t => {
        const updatedT = { ...t, category: newCategoryName };
        update.mutate(updatedT);
    });
    
  }, [allTransactions, update]);

  const importAllData = useCallback(async (data: any) => {
    // ...
  }, [insertMutation, insertCost, insertExpense, insertPartner, insertContract, insertMarketing]);


  // --- NOVO HOOK: Busca de Transações para Resumo (Sem Paginação) ---
  const useFilteredTransactionsSummary = useCallback((
    dateFilter: FilterPeriod,
    customDateRange: { start: Date | undefined; end: Date | undefined },
    accountType: "main" | "reserve" = "main"
  ) => {
    const { filters, filterKey } = getFilterParams(dateFilter, customDateRange);
    
    // Usamos useSupabaseQuery diretamente, passando os filtros
    const { data: summaryTransactions = [], isLoading: isLoadingSummary } = useSupabaseQuery<Transaction>(
        TABLE_NAME,
        [...QUERY_KEY, filterKey, 'summary', accountType], // Chave de cache única para o resumo
        "*",
        !!user,
        [...filters, { column: 'account_type', operator: 'eq', value: accountType }],
        undefined, // Sem limite
        undefined, // Sem offset
        "date",
        false
    );
    
    // Calcula o resumo usando a lista COMPLETA do período filtrado
    const summary = useMemo(() => {
        return calculateSummary(summaryTransactions, allTransactions, costCategoryNames);
    }, [summaryTransactions, allTransactions, costCategoryNames]);
    
    return { summary, isLoadingSummary };
  }, [user, allTransactions, costCategoryNames]);
  // --- FIM NOVO HOOK ---


  return {
    allTransactions, 
    isLoadingTransactions: isLoadingAll,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateTransactionCategoryOnDelete,
    useFilteredTransactionsSummary, // Exporta o novo hook
    importAllData,
  };
}