import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { showError, showSuccess } from "@/utils/toast";
import {
  formatMonthLabel,
  formatMonthName,
  getDaysInMonth,
  getExpectedRatio,
  getGoalMessage,
  getMonthEndReference,
  getMonthReference,
  getPace,
  getPreviousMonth,
  getProgressPercentage,
  getSalesPercentage,
  getCheckpointTargetValue,
  roundCurrency,
} from "@/types/monthlyGoals";
import type { MonthlyGoal, MonthlyGoalDashboardData } from "@/types/monthlyGoals";

const mapGoal = (row: Record<string, unknown>): MonthlyGoal => ({
  id: String(row.id),
  userId: String(row.user_id),
  monthReference: String(row.month_reference),
  targetValue: Number(row.target_value) || 0,
  createdAt: row.created_at ? String(row.created_at) : undefined,
  updatedAt: row.updated_at ? String(row.updated_at) : undefined,
});

async function fetchGoal(userId: string, monthReference: string): Promise<MonthlyGoal | null> {
  const { data, error } = await supabase
    .from("monthly_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("month_reference", monthReference)
    .maybeSingle();

  if (error) throw error;
  return data ? mapGoal(data) : null;
}

async function fetchContractsForMonth(userId: string, monthReference: string, monthEndReference: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select("total_contract_value, date_closed")
    .eq("user_id", userId)
    .gte("date_closed", monthReference)
    .lte("date_closed", monthEndReference);

  if (error) throw error;
  return data ?? [];
}

export function useAnnualMonthlyGoals(year: number) {
  const { user } = useAuth();
  const goalsQuery = useQuery({
    queryKey: ["monthly-goals-year", user?.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("user_id", user!.id)
        .gte("month_reference", `${year}-01-01`)
        .lt("month_reference", `${year + 1}-01-01`);
      if (error) throw error;
      return (data ?? []).map((row) => mapGoal(row));
    },
    enabled: !!user,
  });
  const contractsQuery = useQuery({
    queryKey: ["contracts", "monthly-goals-year", user?.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("total_contract_value, date_closed")
        .eq("user_id", user!.id)
        .gte("date_closed", `${year}-01-01`)
        .lt("date_closed", `${year + 1}-01-01`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const months = useMemo(() => {
    const goalsByMonth = new Map((goalsQuery.data ?? []).map((goal) => [goal.monthReference, goal]));
    const salesByMonth = new Map<string, { value: number; count: number }>();
    (contractsQuery.data ?? []).forEach((contract) => {
      if (!contract.date_closed) return;
      const reference = `${contract.date_closed.slice(0, 7)}-01`;
      const current = salesByMonth.get(reference) ?? { value: 0, count: 0 };
      current.value += Number(contract.total_contract_value || 0);
      current.count += 1;
      salesByMonth.set(reference, current);
    });
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const reference = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
      const goal = goalsByMonth.get(reference);
      const sales = salesByMonth.get(reference) ?? { value: 0, count: 0 };
      return {
        monthReference: reference,
        monthLabel: formatMonthLabel(new Date(year, monthIndex, 1)),
        targetValue: goal?.targetValue ?? 0,
        salesValue: sales.value,
        salesCount: sales.count,
        salesPercentage: getSalesPercentage(sales.value, goal?.targetValue ?? 0),
        hasGoal: !!goal,
      };
    });
  }, [goalsQuery.data, contractsQuery.data, year]);

  return { months, isLoading: goalsQuery.isLoading || contractsQuery.isLoading };
}

export function useMonthlyGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const previousMonth = getPreviousMonth(currentMonth);
  const currentMonthReference = getMonthReference(currentMonth);
  const currentMonthEndReference = getMonthEndReference(currentMonth);
  const previousMonthReference = getMonthReference(previousMonth);
  const previousMonthEndReference = getMonthEndReference(previousMonth);

  const currentMonthContractsQuery = useQuery({
    queryKey: ["contracts", "monthly-goal", user?.id, currentMonthReference],
    queryFn: () => fetchContractsForMonth(user!.id, currentMonthReference, currentMonthEndReference),
    enabled: !!user,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });
  const previousMonthContractsQuery = useQuery({
    queryKey: ["contracts", "monthly-goal", user?.id, previousMonthReference],
    queryFn: () => fetchContractsForMonth(user!.id, previousMonthReference, previousMonthEndReference),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const currentGoalQuery = useQuery({
    queryKey: ["monthly-goal", user?.id, currentMonthReference],
    queryFn: () => fetchGoal(user!.id, currentMonthReference),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const previousGoalQuery = useQuery({
    queryKey: ["monthly-goal", user?.id, previousMonthReference],
    queryFn: () => fetchGoal(user!.id, previousMonthReference),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const saveGoalMutation = useMutation({
    mutationFn: async ({ targetValue, monthReference }: { targetValue: number; monthReference: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");
      if (!Number.isFinite(targetValue) || targetValue < 0) throw new Error("Informe uma meta válida.");
      if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(monthReference) || monthReference < currentMonthReference) {
        throw new Error("Somente metas do mês atual ou de meses futuros podem ser alteradas.");
      }

      const existingGoal = await fetchGoal(user.id, monthReference);
      const values = {
        month_reference: monthReference,
        target_value: roundCurrency(targetValue),
      };

      if (existingGoal) {
        const { data, error } = await supabase
          .from("monthly_goals")
          .update(values)
          .eq("user_id", user.id)
          .eq("month_reference", monthReference)
          .select()
          .single();
        if (error) throw error;
        return mapGoal(data);
      }

      const { data, error } = await supabase
        .from("monthly_goals")
        .insert({ ...values, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return mapGoal(data);
    },
    onSuccess: (goal) => {
      queryClient.setQueryData(["monthly-goal", user?.id, goal.monthReference], goal);
      queryClient.invalidateQueries({ queryKey: ["monthly-goals-year", user?.id, Number(goal.monthReference.slice(0, 4))] });
      showSuccess("Meta mensal salva com sucesso.");
    },
    onError: (error: Error) => showError(`Não foi possível salvar a meta: ${error.message}`),
  });

  const dashboard = useMemo(() => {
    const currentMonthSalesContracts = currentMonthContractsQuery.data ?? [];
    const currentMonthSales = currentMonthSalesContracts.reduce((sum, contract) => sum + Number(contract.total_contract_value || 0), 0);
    const currentMonthSalesCount = currentMonthSalesContracts.length;
    const isPreviousMonthFallback = now.getDate() <= 3 && currentMonthSalesCount === 0;
    const previousMonthSalesContracts = previousMonthContractsQuery.data ?? [];
    const previousMonthSales = previousMonthSalesContracts.reduce((sum, contract) => sum + Number(contract.total_contract_value || 0), 0);

    let selectedMonth = currentMonth;
    let targetValue = Number(currentGoalQuery.data?.targetValue || 0);
    let salesValue = currentMonthSales;
    let salesCount = currentMonthSalesCount;
    let expectedSales = 0;

    if (isPreviousMonthFallback) {
      selectedMonth = previousMonth;
      targetValue = Number(previousGoalQuery.data?.targetValue || 0);
      salesValue = previousMonthSales;
      salesCount = previousMonthSalesContracts.length;
      expectedSales = targetValue;
    } else {
      const expectedRatio = getExpectedRatio(now.getDate(), getDaysInMonth(currentMonth));
      expectedSales = getCheckpointTargetValue(targetValue, expectedRatio);
    }

    const salesPercentage = getSalesPercentage(salesValue, targetValue);
    const progressPercentage = getProgressPercentage(salesValue, targetValue);
    const monthLabel = formatMonthLabel(selectedMonth);
    const currentMonthLabel = formatMonthName(currentMonth);
    const data: MonthlyGoalDashboardData = {
      monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      currentMonthLabel,
      isPreviousMonthFallback,
      targetValue,
      salesValue,
      salesCount,
      expectedSales,
      salesPercentage,
      progressPercentage,
      pace: getPace(salesValue, expectedSales),
      message: getGoalMessage(now.getDate(), getDaysInMonth(currentMonth), isPreviousMonthFallback),
      fallbackObservation: isPreviousMonthFallback
        ? `Sem vendas registradas no mês atual — ${currentMonthLabel}`
        : undefined,
    };

    return data;
  }, [currentMonthContractsQuery.data, previousMonthContractsQuery.data, currentGoalQuery.data, previousGoalQuery.data, currentMonth, previousMonth, now]);

  return {
    currentGoal: currentGoalQuery.data ?? null,
    isLoadingGoal: currentGoalQuery.isLoading,
    dashboard,
    isLoadingDashboard: currentMonthContractsQuery.isLoading || previousMonthContractsQuery.isLoading || currentGoalQuery.isLoading || previousGoalQuery.isLoading,
    saveGoal: (targetValue: number, monthReference = currentMonthReference) => saveGoalMutation.mutateAsync({ targetValue, monthReference }),
    isSavingGoal: saveGoalMutation.isPending,
  };
}
