import { useEffect, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { useMonthlyGoals } from "@/hooks/useMonthlyGoals";
import { formatMonthLabel } from "@/types/monthlyGoals";

export default function MonthlyGoalSettings() {
  const { currentGoal, isLoadingGoal, saveGoal, isSavingGoal } = useMonthlyGoals();
  const { displayValue, numericValue, handleChange, setNumericValue } = useCurrencyInput(0);
  const monthLabel = formatMonthLabel(new Date());
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  useEffect(() => {
    if (!isLoadingGoal) setNumericValue(currentGoal?.targetValue ?? 0);
  }, [currentGoal?.targetValue, isLoadingGoal, setNumericValue]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveGoal(numericValue);
  };

  return (
    <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Meta mensal</CardTitle>
        <CardDescription className="text-gray-400">
          Defina a meta de vendas para {capitalizedMonthLabel}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:max-w-sm">
            <Label htmlFor="monthly-goal-value">Valor da meta</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
              <Input
                id="monthly-goal-value"
                value={displayValue}
                onChange={handleChange}
                inputMode="numeric"
                aria-label="Valor da meta mensal"
                className="pl-10"
                disabled={isLoadingGoal || isSavingGoal}
              />
            </div>
          </div>
          <Button type="submit" disabled={isLoadingGoal || isSavingGoal}>
            {isSavingGoal ? "Salvando..." : "Salvar meta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
