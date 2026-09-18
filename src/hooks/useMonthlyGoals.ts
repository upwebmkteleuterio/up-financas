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
import type { MonthlyGoal, MonthlyGoalDashboardData, MonthlyGoalSnapshot } from "@/types/monthlyGoals";

const mapGoal = (row: Record<string, unknown>): MonthlyGoal => ({
  id: String(row.id),
  userId: String(row.user_id),
  monthReference: String(row.month_reference),
  targetValue: Number(row.target_value) || 0,
  createdAt: row.created_at ? String(row.created_at) : undefined,
  updatedAt: row.updated_at ? String(row.updated_at) : undefined,
});

const mapSnapshot = (row: Record<string, unknown>): MonthlyGoalSnapshot => ({
  id: String(row.id),
  userId: String(row.user_id),
  monthReference: String(row.month_reference),
  checkpointType: row.checkpoint_type as MonthlyGoalSnapshot["checkpointType"],
  checkpointDate: String(row.checkpoint_date),
  capturedAt: String(row.captured_at),
  targetValue: Number(row.target_value) || 0,
  checkpointTargetValue: Number(row.checkpoint_target_value) || 0,
  salesValue: Number(row.sales_value) || 0,
  salesPercentage: Number(row.sales_percentage) || 0,
});

async function fetchCurrentGoal(userId: string, monthReference: string): Promise<MonthlyGoal | null> {
  const { data, error } = await supabase
    .from("monthly_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("month_reference", monthReference)
    .maybeSingle();

  if (error) throw error;
  return data ? mapGoal(data) : null;
}

async function fetchPreviousFinalSnapshot(userId: string, monthReference: string): Promise<MonthlyGoalSnapshot | null> {
  const { data, error } = await supabase
    .from("monthly_goal_snapshots")
    .select("*")
    .eq("user_id", userId)
    .eq("month_reference", monthReference)
    .eq("checkpoint_type", "final")
    .maybeSingle();

  if (error) throw error;
  return data ? mapSnapshot(data) : null;
}

async function fetchCurrentMonthContracts(userId: string, monthReference: string, monthEndReference: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select("total_contract_value, date_closed")
    .eq("user_id", userId)
    .gte("date_closed", monthReference)
    .lte("date_closed", monthEndReference);

  if (error) throw error;
  return data ?? [];
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

  const currentMonthContractsQuery = useQuery({
    queryKey: ["contracts", "monthly-goal", user?.id, currentMonthReference],
    queryFn: () => fetchCurrentMonthContracts(user!.id, currentMonthReference, currentMonthEndReference),
    enabled: !!user,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });

  const currentGoalQuery = useQuery({
    queryKey: ["monthly-goal", user?.id, currentMonthReference],
    queryFn: () => fetchCurrentGoal(user!.id, currentMonthReference),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const previousSnapshotQuery = useQuery({
    queryKey: ["monthly-goal-snapshot-final", user?.id, previousMonthReference],
    queryFn: () => fetchPreviousFinalSnapshot(user!.id, previousMonthReference),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const saveGoalMutation = useMutation({
    mutationFn: async (targetValue: number) => {
      if (!user) throw new Error("Usuário não autenticado.");
      if (!Number.isFinite(targetValue) || targetValue < 0) throw new Error("Informe uma meta válida.");

      const { data, error } = await supabase
        .from("monthly_goals")
        .upsert(
          {
            user_id: user.id,
            month_reference: currentMonthReference,
            target_value: roundCurrency(targetValue),
          },
          { onConflict: "user_id,month_reference" },
        )
        .select()
        .single();

      if (error) throw error;
      return mapGoal(data);
    },
    onSuccess: (goal) => {
      queryClient.setQueryData(["monthly-goal", user?.id, currentMonthReference], goal);
      showSuccess("Meta mensal salva com sucesso.");
    },
    onError: (error: Error) => showError(`Não foi possível salvar a meta: ${error.message}`),
  });

  const dashboard = useMemo(() => {
    const currentMonthSalesContracts = currentMonthContractsQuery.data ?? [];
    const currentMonthSales = currentMonthSalesContracts.reduce((sum, contract) => sum + Number(contract.total_contract_value || 0), 0);
    const currentMonthSalesCount = currentMonthSalesContracts.length;
    const isPreviousMonthFallback = now.getDate() <= 3 && currentMonthSalesCount === 0;
    const previousSnapshot = previousSnapshotQuery.data;

    let selectedMonth = currentMonth;
    let targetValue = Number(currentGoalQuery.data?.targetValue || 0);
    let salesValue = currentMonthSales;
    let salesCount = currentMonthSalesCount;
    let expectedSales = 0;

    if (isPreviousMonthFallback) {
      selectedMonth = previousMonth;
      targetValue = previousSnapshot?.targetValue || 0;
      salesValue = previousSnapshot?.salesValue || 0;
      salesCount = previousSnapshot ? 0 : 0;
      expectedSales = previousSnapshot?.checkpointTargetValue || targetValue;
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
      message: getGoalMessage(now.getDate(), getDaysInMonth(currentMonth), salesPercentage, isPreviousMonthFallback),
      fallbackObservation: isPreviousMonthFallback
        ? `Sem vendas registradas no mês atual — ${currentMonthLabel}`
        : undefined,
    };

    return data;
  }, [currentMonthContractsQuery.data, currentGoalQuery.data, previousSnapshotQuery.data, currentMonth, previousMonth, now]);

  return {
    currentGoal: currentGoalQuery.data ?? null,
    isLoadingGoal: currentGoalQuery.isLoading,
    dashboard,
    isLoadingDashboard: currentMonthContractsQuery.isLoading || currentGoalQuery.isLoading || previousSnapshotQuery.isLoading,
    saveGoal: saveGoalMutation.mutateAsync,
    isSavingGoal: saveGoalMutation.isPending,
  };
}
