import { useState, useCallback, useMemo } from "react";
import { ExpenseCategory } from "@/types/finance";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";

const TABLE_NAME = "expense_categories";
const QUERY_KEY = [TABLE_NAME];
const OTHER_EXPENSES_NAME = "Outros Gastos";

export function useExpenseCategories() {
  const { user } = useAuth();
  
  // Query para buscar todas as categorias de gasto
  const { data: rawExpenseCategories = [], isLoading: isLoadingCategories } = useSupabaseQuery<ExpenseCategory>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user
  );

  // Mutações
  const { insert, update, remove } = useSupabaseMutation<ExpenseCategory, Omit<ExpenseCategory, "id">>(
    TABLE_NAME,
    QUERY_KEY
  );

  // Memoiza a lista de categorias, garantindo que 'Outros Gastos' esteja sempre no topo
  const expenseCategories = useMemo(() => {
    const otherExpenses = rawExpenseCategories.find(c => c.name === OTHER_EXPENSES_NAME);
    const otherCategories = rawExpenseCategories.filter(c => c.name !== OTHER_EXPENSES_NAME);
    
    // Se 'Outros Gastos' existir, coloca no topo. Caso contrário, retorna a lista bruta.
    if (otherExpenses) {
        return [otherExpenses, ...otherCategories];
    }
    return rawExpenseCategories;
  }, [rawExpenseCategories]);

  const addExpenseCategory = useCallback((name: string) => {
    const newCategory: Omit<ExpenseCategory, "id"> = {
      name: name,
    };
    // Adiciona a nova categoria ao Supabase
    insert.mutate(newCategory);
  }, [insert]);
  
  const updateExpenseCategory = useCallback((updatedCategory: ExpenseCategory) => {
    // Atualiza a categoria no Supabase
    update.mutate(updatedCategory);
  }, [update]);

  const deleteExpenseCategory = useCallback((id: string) => {
    // Remove a categoria do Supabase
    remove.mutate(id);
  }, [remove]);

  const getCategoryNameById = useCallback((id: string) => {
    return expenseCategories.find(c => c.id === id)?.name;
  }, [expenseCategories]);

  return {
    expenseCategories,
    isLoadingCategories,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    getCategoryNameById,
  };
}