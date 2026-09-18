export interface MonthlyGoal {
  id: string;
  userId: string;
  monthReference: string;
  targetValue: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MonthlyGoalSnapshot {
  id: string;
  userId: string;
  monthReference: string;
  checkpointType: "day_5" | "day_10" | "day_15" | "day_20" | "day_25" | "final";
  checkpointDate: string;
  capturedAt: string;
  targetValue: number;
  checkpointTargetValue: number;
  salesValue: number;
  salesPercentage: number;
}

export type GoalPace = "green" | "yellow" | "red";

export interface MonthlyGoalDashboardData {
  monthLabel: string;
  currentMonthLabel: string;
  isPreviousMonthFallback: boolean;
  targetValue: number;
  salesValue: number;
  salesCount: number;
  expectedSales: number;
  salesPercentage: number;
  progressPercentage: number;
  pace: GoalPace;
  message: string;
  fallbackObservation?: string;
}

export interface MonthlyGoalDashboardState {
  data: MonthlyGoalDashboardData;
  isLoading: boolean;
}

export function getExpectedRatio(day: number, daysInMonth: number): number {
  const points = [
    { day: 1, ratio: 0 },
    { day: 5, ratio: 1 / 6 },
    { day: 10, ratio: 1 / 3 },
    { day: 15, ratio: 1 / 2 },
    { day: 20, ratio: 2 / 3 },
    { day: 25, ratio: 5 / 6 },
    { day: daysInMonth, ratio: 1 },
  ];

  if (day <= 1) return 0;
  if (day >= daysInMonth) return 1;

  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    const left = points[index - 1];
    if (day <= right.day) {
      const distance = right.day - left.day;
      return left.ratio + ((day - left.day) / distance) * (right.ratio - left.ratio);
    }
  }

  return 1;
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getMonthReference(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function getMonthEndReference(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

export function formatMonthName(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
}

export function getSalesPercentage(salesValue: number, targetValue: number): number {
  return targetValue > 0 ? roundCurrency((salesValue / targetValue) * 100) : 0;
}

export function getPace(salesValue: number, expectedSales: number): GoalPace {
  if (expectedSales <= 0 || salesValue / expectedSales >= 1) return "green";
  if (salesValue / expectedSales >= 0.8) return "yellow";
  return "red";
}

export function getProgressPercentage(salesValue: number, targetValue: number): number {
  return targetValue > 0 ? Math.min(100, (salesValue / targetValue) * 100) : 0;
}

export function getGoalMessage(day: number, daysInMonth: number, isPreviousMonthFallback: boolean): string {
  const percentageToken = "{{percentage}}";
  if (isPreviousMonthFallback) return `Resultado final: atingimos ${percentageToken} da meta de vendas.`;
  if (day === 5 || day === 6) return `Chegamos a um sexto do mês e atingimos ${percentageToken} da meta de vendas.`;
  if (day === 10 || day === 11) return `Chegamos a um terço do mês e atingimos ${percentageToken} da meta de vendas.`;
  if (day === 15 || day === 16) return `Chegamos à metade do mês e atingimos ${percentageToken} da meta de vendas.`;
  if (day === 20 || day === 21) return `Chegamos a dois terços do mês e atingimos ${percentageToken} da meta de vendas.`;
  if (day >= 25 && day < daysInMonth) return `Estamos chegando ao fim do mês e atingimos ${percentageToken} da meta de vendas.`;
  if (day === daysInMonth) return `Chegamos ao final do mês e atingimos ${percentageToken} da meta de vendas.`;
  return `Atingimos ${percentageToken} da meta de vendas.`;
}

export function getPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function getCheckpointTargetValue(targetValue: number, ratio: number): number {
  return roundCurrency(targetValue * ratio);
}
