import { useCallback, useMemo } from "react";
import { ExpenseCategory } from "@/types/finance";
import { useOutgoingPrograms } from "./useOutgoingPrograms";

export function useExpenseCategories() {
  const { programs, isLoading, saveProgram } = useOutgoingPrograms();
  const outgoingExpenses = useMemo(() => programs.filter(program => program.kind === "expense"), [programs]);
  const expenseCategories: ExpenseCategory[] = useMemo(() => outgoingExpenses.map(program => ({ id: program.id, name: program.name, isActive: program.isActive })).sort((a, b) => {
    if (a.name === "Outros Gastos") return -1;
    if (b.name === "Outros Gastos") return 1;
    return a.name.localeCompare(b.name);
  }), [outgoingExpenses]);
  const addExpenseCategory = useCallback((name: string) => saveProgram({ name, kind: "expense", frequency: "none", isActive: true }), [saveProgram]);
  const updateExpenseCategory = useCallback((category: ExpenseCategory) => {
    const original = outgoingExpenses.find(program => program.id === category.id);
    if (original) return saveProgram({ ...original, name: category.name });
  }, [outgoingExpenses, saveProgram]);
  const deleteExpenseCategory = useCallback((id: string) => {
    const original = outgoingExpenses.find(program => program.id === id);
    if (original) return saveProgram({ ...original, isActive: false });
  }, [outgoingExpenses, saveProgram]);
  const getCategoryNameById = useCallback((id: string) => expenseCategories.find(category => category.id === id)?.name, [expenseCategories]);
  return { expenseCategories: expenseCategories.filter(category => category.isActive), isLoadingCategories: isLoading, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory, getCategoryNameById };
}
