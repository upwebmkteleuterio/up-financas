import { useState, useMemo, useCallback } from "react";
import { CostCategory } from "@/types/finance";
import { parseISO } from "date-fns";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";

const TABLE_NAME = "cost_categories";
const QUERY_KEY = [TABLE_NAME];

// Função auxiliar para extrair o dia do mês para ordenação
const getDueDay = (category: CostCategory): number => {
    if (category.type === "Fixo" && category.dueDate) {
        try {
            // Extrai o dia do mês (1-31)
            return parseISO(category.dueDate).getDate();
        } catch (e) {
            // Em caso de erro de parsing (data inválida), trata como variável
            return 32;
        }
    }
    // Coloca custos variáveis no final (dia 32)
    return 32; 
};

export function useCosts() {
  const { user } = useAuth();
  
  // Query para buscar todas as categorias de custo
  const { data: costCategories = [], isLoading: isLoadingCosts } = useSupabaseQuery<CostCategory>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user
  );

  // Mutações
  // O tipo V (valor de inserção) é Omit<CostCategory, "id" | "isActive">
  const { insert, update, remove } = useSupabaseMutation<CostCategory, Omit<CostCategory, "id" | "isActive">>(
    TABLE_NAME,
    QUERY_KEY
  );

  const sortedCostCategories = useMemo(() => {
    // 1. Ordena por dia de vencimento (1 a 31)
    const sorted = [...costCategories].sort((a, b) => getDueDay(a) - getDueDay(b));
    
    // 2. Garante que as categorias ativas venham antes das inativas
    return sorted.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });
  }, [costCategories]);

  const addCostCategory = useCallback((newCategory: Omit<CostCategory, "id" | "isActive">) => {
    // Adiciona isActive: true e envia o objeto camelCase
    const categoryToInsert = { ...newCategory, isActive: true };
    insert.mutate(categoryToInsert as any);
  }, [insert]);
  
  const updateCostCategory = useCallback((updatedCategory: CostCategory) => {
    // Envia o objeto camelCase completo
    update.mutate(updatedCategory);
  }, [update]);

  const deleteCostCategory = useCallback((id: string) => {
    remove.mutate(id);
  }, [remove]);

  const toggleCostCategoryActive = useCallback((id: string) => {
    const category = costCategories.find(c => c.id === id);
    if (category) {
        const newIsActive = !category.isActive;
        
        // Envia o objeto camelCase completo com o estado atualizado
        const updatedCategory = { ...category, isActive: newIsActive };
        
        update.mutate(updatedCategory);
    }
  }, [costCategories, update]);

  const summary = useMemo(() => {
    const activeFixedCosts = costCategories
      .filter(c => c.isActive && c.type === "Fixo" && c.value)
      .reduce((sum, c) => sum + c.value!, 0);

    return {
      totalActiveFixedCosts: activeFixedCosts,
    };
  }, [costCategories]);

  return {
    costCategories: sortedCostCategories, // Exporta a lista ordenada
    isLoadingCosts,
    addCostCategory,
    updateCostCategory,
    deleteCostCategory,
    toggleCostCategoryActive,
    summary,
  };
}