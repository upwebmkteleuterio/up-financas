import { useCallback, useMemo } from "react";
import { CostCategory } from "@/types/finance";
import { useOutgoingPrograms } from "./useOutgoingPrograms";

export function useCosts() {
  const { programs, isLoading, saveProgram } = useOutgoingPrograms();
  const outgoingCosts = useMemo(() => programs.filter(program => program.kind === "cost"), [programs]);
  const costCategories: CostCategory[] = useMemo(() => outgoingCosts.map(program => {
    const start = program.startDate ? new Date(`${program.startDate}T00:00:00`) : null;
    const dueDay = start && program.dueDay ? Math.min(program.dueDay, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()) : null;
    const dueDate = start && dueDay ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}` : undefined;
    return {
      id: program.id,
      name: program.name,
      type: program.costType || "Variável",
      dueDate,
      value: program.value == null ? undefined : Number(program.value),
      description: program.description || undefined,
      isActive: program.isActive,
    };
  }).sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  }), [outgoingCosts]);
  const addCostCategory = useCallback((category: Omit<CostCategory, "id" | "isActive">) => saveProgram({
    name: category.name,
    description: category.description,
    value: category.value,
    kind: "cost",
    costType: category.type,
    frequency: category.type === "Fixo" ? "monthly" : "none",
    startDate: category.dueDate,
    dueDay: category.dueDate ? new Date(`${category.dueDate}T00:00:00`).getDate() : undefined,
    isActive: true,
  }), [saveProgram]);
  const updateCostCategory = useCallback((category: CostCategory) => {
    const original = outgoingCosts.find(program => program.id === category.id);
    if (!original) return;
    return saveProgram({ ...original, name: category.name, description: category.description, value: category.value, costType: category.type,
      historicalNames: category.name !== original.name ? Array.from(new Set([...(original.historicalNames || []), original.name])) : original.historicalNames,
      frequency: category.type === "Fixo" ? (original.frequency === "none" ? "monthly" : original.frequency) : original.frequency,
      startDate: category.dueDate || original.startDate, dueDay: category.dueDate ? new Date(`${category.dueDate}T00:00:00`).getDate() : original.dueDay });
  }, [outgoingCosts, saveProgram]);
  const deleteCostCategory = useCallback((id: string) => {
    const program = outgoingCosts.find(item => item.id === id);
    if (program) return saveProgram({ ...program, isActive: false });
  }, [outgoingCosts, saveProgram]);
  const toggleCostCategoryActive = useCallback((id: string) => {
    const program = outgoingCosts.find(item => item.id === id);
    if (program) return saveProgram({ ...program, isActive: !program.isActive });
  }, [outgoingCosts, saveProgram]);
  const summary = useMemo(() => ({ totalActiveFixedCosts: costCategories.filter(c => c.isActive && c.type === "Fixo" && c.value).reduce((total, c) => total + c.value!, 0) }), [costCategories]);
  return { costCategories, isLoadingCosts: isLoading, addCostCategory, updateCostCategory, deleteCostCategory, toggleCostCategoryActive, summary };
}
