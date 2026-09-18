import { CalendarDays, Gauge, ShoppingBag, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import HiddenValue from "@/components/HiddenValue";
import { useMonthlyGoals } from "@/hooks/useMonthlyGoals";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const paceStyles = {
  green: { text: "text-green-400", bar: "from-green-400 via-green-500 to-green-600", label: "No ritmo da meta" },
  yellow: { text: "text-yellow-400", bar: "from-yellow-300 via-yellow-400 to-yellow-500", label: "Atenção ao ritmo" },
  red: { text: "text-red-400", bar: "from-red-400 via-red-500 to-red-600", label: "Abaixo do ritmo" },
};

export default function MonthlyGoalDashboardSection() {
  const { dashboard, isLoadingDashboard } = useMonthlyGoals();
  const paceStyle = paceStyles[dashboard.pace];
  const remainingValue = Math.max(0, dashboard.targetValue - dashboard.salesValue);
  const messageParts = dashboard.message.split("{{percentage}}");

  return (
    <section className="space-y-4" aria-label="Desempenho do mês">
      <h2 className="flex items-center text-sm font-bold uppercase tracking-wider text-gray-500">
        <Target className="mr-2 h-4 w-4" />
        Desempenho do mês
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Meta e progresso</CardTitle>
              <p className="mt-1 text-sm capitalize text-gray-400">{dashboard.monthLabel}</p>
            </div>
            <Gauge className={cn("h-5 w-5", paceStyle.text)} />
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingDashboard ? (
              <div className="h-28 animate-pulse rounded bg-sidebar-accent/40" />
            ) : (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Vendas acumuladas</p>
                    <p className="text-2xl font-bold text-sidebar-primary-foreground">
                      <HiddenValue value={dashboard.salesValue} formatFn={formatCurrency} />
                    </p>
                  </div>
                  <div className={cn("text-right text-sm font-semibold", paceStyle.text)}>
                    <p>
                      <HiddenValue value={dashboard.salesPercentage} isCurrency={false} />% da meta
                    </p>
                    <p className="mt-1 text-xs font-normal text-gray-400">
                      Meta esperada para hoje: <HiddenValue value={dashboard.expectedSales} formatFn={formatCurrency} />
                    </p>
                    <p className="text-xs font-normal text-gray-400">{paceStyle.label}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 overflow-hidden rounded-full bg-sidebar-accent">
                    <div
                      className={cn(
                        "monthly-goal-progress-fill h-full rounded-full bg-gradient-to-r transition-all",
                        paceStyle.bar,
                      )}
                      style={{ width: `${dashboard.progressPercentage}%` }}
                      role="progressbar"
                      aria-valuenow={dashboard.progressPercentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs text-gray-400 sm:grid-cols-2 sm:gap-2">
                    <span>Meta: <HiddenValue value={dashboard.targetValue} formatFn={formatCurrency} /></span>
                    <span>Falta: <HiddenValue value={remainingValue} formatFn={formatCurrency} /></span>
                  </div>
                </div>
                <div className="rounded-md border border-sidebar-border bg-sidebar-accent/30 p-3 text-sm text-gray-300">
                  {messageParts[0]}
                  <HiddenValue value={dashboard.salesPercentage} isCurrency={false} />%
                  {messageParts[1]}
                </div>
                {dashboard.fallbackObservation && (
                  <p className="text-xs text-gray-400">{dashboard.fallbackObservation}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Vendas fechadas</CardTitle>
              <p className="mt-1 text-sm capitalize text-gray-400">{dashboard.monthLabel}</p>
            </div>
            <ShoppingBag className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <div className="h-24 animate-pulse rounded bg-sidebar-accent/40" />
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-gray-400">Total vendido em contratos</p>
                  <p className="mt-1 text-3xl font-bold text-sidebar-primary-foreground">
                    <HiddenValue value={dashboard.salesValue} formatFn={formatCurrency} />
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-sidebar-border pt-4">
                  <div>
                    <p className="text-xs text-gray-400">Contratos registrados</p>
                    <p className="mt-1 text-lg font-semibold">
                      <HiddenValue value={dashboard.salesCount} isCurrency={false} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Meta selecionada</p>
                    <p className="mt-1 text-lg font-semibold">
                      <HiddenValue value={dashboard.targetValue} formatFn={formatCurrency} />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <CalendarDays className="h-4 w-4" />
                  <span>O progresso considera a data de fechamento dos contratos.</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
