import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnnualMonthlyGoals, useMonthlyGoals } from "@/hooks/useMonthlyGoals";
import { getMonthReference } from "@/types/monthlyGoals";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function AnnualGoalRow({
  month,
  isEditable,
  isSaving,
  onSave,
}: {
  month: ReturnType<typeof useAnnualMonthlyGoals>["months"][number];
  isEditable: boolean;
  isSaving: boolean;
  onSave: (value: number, reference: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(month.hasGoal ? String(month.targetValue) : "");

  useEffect(() => {
    setValue(month.hasGoal ? String(month.targetValue) : "");
  }, [month.targetValue, month.hasGoal]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(value);
    if (value.trim() === "" || !Number.isFinite(parsed) || parsed < 0) return;
    await onSave(parsed, month.monthReference);
  };

  return (
    <TableRow>
      <TableCell className="font-medium capitalize">{month.monthLabel}</TableCell>
      <TableCell>
        {isEditable ? (
          <form className="flex min-w-[220px] items-center gap-2" onSubmit={handleSubmit}>
            <Label className="sr-only" htmlFor={`goal-${month.monthReference}`}>Meta mensal</Label>
            <Input
              id={`goal-${month.monthReference}`}
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Definir meta"
              aria-label={`Meta para ${month.monthLabel}`}
              disabled={isSaving}
              className="max-w-40"
            />
            <Button type="submit" size="sm" disabled={isSaving || value.trim() === ""}>
              Salvar
            </Button>
          </form>
        ) : (
          <span>{month.hasGoal ? formatCurrency(month.targetValue) : "—"}</span>
        )}
      </TableCell>
      <TableCell>{formatCurrency(month.salesValue)}</TableCell>
      <TableCell>{month.salesCount}</TableCell>
      <TableCell>{month.salesPercentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</TableCell>
      <TableCell>
        {isEditable ? <span className="text-xs text-muted-foreground">Editável</span> : <span className="text-xs text-muted-foreground">Histórico</span>}
      </TableCell>
    </TableRow>
  );
}

export default function MetasAnuais() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { months, isLoading } = useAnnualMonthlyGoals(year);
  const { saveGoal, isSavingGoal } = useMonthlyGoals();
  const currentMonthReference = getMonthReference(new Date());

  return (
    <Layout pageTitle="Metas anuais" pageSubtitle="Acompanhe metas e vendas fechadas em cada mês.">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-sidebar-primary-foreground">
              <Target className="h-7 w-7" /> Metas anuais
            </h1>
            <p className="mt-1 text-gray-400">Metas, contratos fechados e atingimento mensal.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-lg border border-sidebar-border bg-sidebar p-1 sm:self-auto">
            <Button variant="ghost" size="icon" aria-label="Ano anterior" onClick={() => setYear((value) => value - 1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-16 text-center text-lg font-semibold">{year}</span>
            <Button variant="ghost" size="icon" aria-label="Próximo ano" onClick={() => setYear((value) => value + 1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Card className="border-sidebar-border bg-sidebar text-sidebar-foreground">
          <CardHeader>
            <CardTitle>Resumo de {year}</CardTitle>
            <CardDescription className="text-gray-400">
              Meses encerrados são mantidos como histórico; o ano novo começa sem metas cadastradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 animate-pulse rounded-md bg-sidebar-accent/40" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Meta salva</TableHead>
                      <TableHead>Contratos fechados</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Atingido</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {months.map((month) => (
                      <AnnualGoalRow
                        key={month.monthReference}
                        month={month}
                        isEditable={month.monthReference >= currentMonthReference}
                        isSaving={isSavingGoal}
                        onSave={saveGoal}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
