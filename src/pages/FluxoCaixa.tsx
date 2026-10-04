import { useMemo, useState } from "react";
import { addWeeks, endOfMonth, endOfWeek, format, isWithinInterval, startOfMonth, startOfWeek, subWeeks } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import { useRecebimentos } from "@/hooks/useRecebimentos";
import { useOutgoingOccurrences } from "@/hooks/useOutgoingPrograms";
import { useFinance } from "@/hooks/use-finance";
import { createLocalDateFromISO } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const monthFilters = Array.from({ length: 12 }, (_, month) => `month_${month}` as FilterPeriod);
const allowedFilters: FilterPeriod[] = [
  ...monthFilters,
  "last_month", "next_month", "current_week", "next_week", "last_week", "custom",
];

function boundsFor(period: FilterPeriod, custom: { start: Date | undefined; end: Date | undefined }) {
  const now = new Date();
  const weekOptions = { weekStartsOn: 1 as const };
  if (period === "custom" && custom.start && custom.end) return { start: custom.start, end: custom.end };
  if (period === "current_week") return { start: startOfWeek(now, weekOptions), end: endOfWeek(now, weekOptions) };
  if (period === "next_week") { const date = addWeeks(now, 1); return { start: startOfWeek(date, weekOptions), end: endOfWeek(date, weekOptions) }; }
  if (period === "last_week") { const date = subWeeks(now, 1); return { start: startOfWeek(date, weekOptions), end: endOfWeek(date, weekOptions) }; }
  if (period === "last_month") { const date = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: startOfMonth(date), end: endOfMonth(date) }; }
  if (period === "next_month") { const date = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { start: startOfMonth(date), end: endOfMonth(date) }; }
  if (period.startsWith("month_")) { const date = new Date(now.getFullYear(), Number(period.split("_")[1]), 1); return { start: startOfMonth(date), end: endOfMonth(date) }; }
  return { start: startOfMonth(now), end: endOfMonth(now) };
}

const transactionNet = (transactions: ReturnType<typeof useFinance>["allTransactions"], accountType: "main" | "reserve") =>
  transactions.filter(transaction => (transaction.accountType || "main") === accountType)
    .reduce((sum, transaction) => sum + (transaction.type === "Entrada" ? transaction.value : -transaction.value), 0);

export default function FluxoCaixa() {
  const [period, setPeriod] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [custom, setCustom] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });
  const { recebimentos } = useRecebimentos();
  const { allTransactions, balanceByAccount } = useFinance();
  const bounds = boundsFor(period, custom);
  const today = new Date();
  const todayISO = format(today, "yyyy-MM-dd");
  const endISO = format(bounds.end, "yyyy-MM-dd");
  const forecastStart = bounds.start > today ? today : bounds.start;
  const forecastStartISO = format(forecastStart, "yyyy-MM-dd");
  const { pending, programs } = useOutgoingOccurrences({ start: forecastStart, end: bounds.end });
  const selected = (date: string) => isWithinInterval(createLocalDateFromISO(date), bounds);
  const report = useMemo(() => {
    const actuals = allTransactions.filter(transaction => selected(transaction.date));
    const realizedIncome = actuals.filter(transaction => transaction.type === "Entrada" && !transaction.isTransfer).reduce((sum, transaction) => sum + transaction.value, 0);
    const realizedOut = actuals.filter(transaction => transaction.type === "Saída" && !transaction.isTransfer).reduce((sum, transaction) => sum + transaction.value, 0);
    const realizedMain = actuals.filter(transaction => (transaction.accountType || "main") === "main").reduce((sum, transaction) => sum + (transaction.type === "Entrada" ? transaction.value : -transaction.value), 0);
    const realizedReserve = actuals.filter(transaction => transaction.accountType === "reserve").reduce((sum, transaction) => sum + (transaction.type === "Entrada" ? transaction.value : -transaction.value), 0);
    const periodReceipts = recebimentos.filter(receipt => selected(receipt.dueDate));
    const projectedIncome = periodReceipts.reduce((sum, receipt) => sum + receipt.value, 0);
    const projected = pending.filter(occurrence => selected(occurrence.dueDate));
    const projectedMainOut = projected.filter(occurrence => occurrence.program?.kind !== "cash_reserve").reduce((sum, occurrence) => sum + occurrence.scheduledValue, 0);
    const projectedReserveTransfer = projected.filter(occurrence => occurrence.program?.kind === "cash_reserve").reduce((sum, occurrence) => sum + occurrence.scheduledValue, 0);

    const futureTransactions = allTransactions.filter(transaction => transaction.date > todayISO);
    const balanceTodayMain = balanceByAccount.main - transactionNet(futureTransactions, "main");
    const balanceTodayReserve = balanceByAccount.reserve - transactionNet(futureTransactions, "reserve");
    const bookedFutureTransactions = futureTransactions.filter(transaction => transaction.date <= endISO);
    const bookedFutureMain = transactionNet(bookedFutureTransactions, "main");
    const bookedFutureReserve = transactionNet(bookedFutureTransactions, "reserve");
    const forecastReceipts = recebimentos.filter(receipt => receipt.dueDate >= forecastStartISO && receipt.dueDate <= endISO).reduce((sum, receipt) => sum + receipt.value, 0);
    const forecastOccurrences = pending.filter(occurrence => occurrence.dueDate >= forecastStartISO && occurrence.dueDate <= endISO);
    const forecastMainOut = forecastOccurrences.filter(occurrence => occurrence.program?.kind !== "cash_reserve").reduce((sum, occurrence) => sum + occurrence.scheduledValue, 0);
    const forecastReserveTransfer = forecastOccurrences.filter(occurrence => occurrence.program?.kind === "cash_reserve").reduce((sum, occurrence) => sum + occurrence.scheduledValue, 0);
    const hasProjectedEnd = bounds.end >= startOfDay(today);
    const projectedEndMain = balanceTodayMain + bookedFutureMain + forecastReceipts - forecastMainOut - forecastReserveTransfer;
    const projectedEndReserve = balanceTodayReserve + bookedFutureReserve + forecastReserveTransfer;

    return {
      actuals, realizedIncome, realizedOut, realizedMain, realizedReserve, projectedIncome, projectedMainOut,
      projectedReserveTransfer, projected, balanceTodayMain, balanceTodayReserve, hasProjectedEnd,
      projectedEndMain, projectedEndReserve,
    };
  }, [allTransactions, balanceByAccount, recebimentos, pending, bounds.start.getTime(), bounds.end.getTime(), todayISO, endISO, forecastStartISO]);
  const categoryName = (programId: string) => programs.find(program => program.id === programId)?.name || "Saída programada";

  return <Layout pageTitle="Fluxo de Caixa" pageSubtitle="Movimentações realizadas e previsões, com contas separadas.">
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold">Fluxo de Caixa</h1><p className="mt-1 text-muted-foreground">Saldo líquido não representa lucro contábil.</p></div><FilterDropdown activeFilter={period} setActiveFilter={setPeriod} customDateRange={custom} setCustomDateRange={setCustom} allowedFilters={allowedFilters} /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-sidebar-primary-foreground"><Wallet className="h-4 w-4 text-blue-400"/>Conta principal</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-sm text-gray-400">Saldo atual: <strong className="text-sidebar-primary-foreground">{money(report.balanceTodayMain)}</strong></p>{report.hasProjectedEnd && <p className="text-sm text-gray-400">Saldo projetado ao fim do período: <strong className="text-sidebar-primary-foreground">{money(report.projectedEndMain)}</strong></p>}<p className="text-sm text-sidebar-primary-foreground">Realizado líquido no período: <strong>{money(report.realizedMain)}</strong></p><p className="text-sm text-gray-400">Inclui previsões até o fim do intervalo selecionado; pendências vencidas antes dele não entram automaticamente no saldo final.</p></CardContent></Card>
        <Card className="border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-sidebar-primary-foreground"><Wallet className="h-4 w-4 text-green-400"/>Fundo de Caixa</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-sm text-gray-400">Saldo atual: <strong className="text-sidebar-primary-foreground">{money(report.balanceTodayReserve)}</strong></p>{report.hasProjectedEnd && <p className="text-sm text-gray-400">Saldo projetado ao fim do período: <strong className="text-sidebar-primary-foreground">{money(report.projectedEndReserve)}</strong></p>}<p className="text-sm text-sidebar-primary-foreground">Realizado líquido no período: <strong>{money(report.realizedReserve)}</strong></p><p className="text-sm text-gray-400">Transferências internas são refletidas entre contas, não como despesa consolidada.</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><Card className="border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg"><CardContent className="flex items-center gap-3 p-5"><div className="rounded-lg bg-green-900/40 p-2"><ArrowDownLeft className="h-5 w-5 text-green-500"/></div><div><p className="text-xs text-gray-400">Entradas realizadas</p><strong className="text-sidebar-primary-foreground">{money(report.realizedIncome)}</strong><p className="text-xs text-gray-400">Previstas: {money(report.projectedIncome)}</p></div></CardContent></Card><Card className="border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg"><CardContent className="flex items-center gap-3 p-5"><div className="rounded-lg bg-red-900/30 p-2"><ArrowUpRight className="h-5 w-5 text-red-400"/></div><div><p className="text-xs text-gray-400">Saídas realizadas (sem transferências internas)</p><strong className="text-sidebar-primary-foreground">{money(report.realizedOut)}</strong><p className="text-xs text-gray-400">Previstas: {money(report.projectedMainOut)}</p></div></CardContent></Card></div>
      <Card className="border-sidebar-border bg-sidebar text-sidebar-foreground"><CardHeader><CardTitle className="text-sidebar-primary-foreground">Movimentações previstas</CardTitle></CardHeader><CardContent className="space-y-1">{recebimentos.filter(receipt => selected(receipt.dueDate)).map(receipt => <div key={`income-${receipt.id}`} className="flex justify-between gap-4 border-b border-sidebar-border p-4 text-sm transition-colors hover:bg-sidebar-accent/30"><span className="text-gray-400">Recebimento · {receipt.clientName} · {format(createLocalDateFromISO(receipt.dueDate), "dd/MM/yyyy")}</span><strong className="whitespace-nowrap text-green-500">+ {money(receipt.value)}</strong></div>)}{report.projected.map(occurrence => <div key={`out-${occurrence.id || `${occurrence.programId}-${occurrence.sequenceNumber}-${occurrence.dueDate}`}`} className="flex justify-between gap-4 border-b border-sidebar-border p-4 text-sm transition-colors hover:bg-sidebar-accent/30"><span className="text-gray-400">{occurrence.program?.kind === "cash_reserve" ? "Transferência prevista para Fundo" : `Saída · ${categoryName(occurrence.programId)}`} · {format(createLocalDateFromISO(occurrence.dueDate), "dd/MM/yyyy")}</span><strong className={`whitespace-nowrap ${occurrence.program?.kind === "cash_reserve" ? "text-blue-400" : "text-red-400"}`}>{occurrence.program?.kind === "cash_reserve" ? "↔ " : "− "}{money(occurrence.scheduledValue)}</strong></div>)}{!recebimentos.some(receipt => selected(receipt.dueDate)) && report.projected.length === 0 && <p className="p-6 text-center text-gray-400">Sem previsões para o período.</p>}</CardContent></Card>
      <Card className="border-sidebar-border bg-sidebar text-sidebar-foreground"><CardHeader><CardTitle className="text-sidebar-primary-foreground">Movimentações realizadas</CardTitle></CardHeader><CardContent className="space-y-1">{report.actuals.map(transaction => <div key={transaction.id} className="flex justify-between gap-4 border-b border-sidebar-border p-4 text-sm transition-colors hover:bg-sidebar-accent/30"><span className="text-gray-400">{transaction.type} · {transaction.description} · {format(createLocalDateFromISO(transaction.date), "dd/MM/yyyy")} {transaction.isTransfer && <span className="text-blue-400">(transferência interna)</span>}</span><strong className={`whitespace-nowrap ${transaction.isTransfer ? "text-blue-400" : transaction.type === "Entrada" ? "text-green-500" : "text-red-400"}`}>{transaction.isTransfer ? "↔ " : transaction.type === "Entrada" ? "+ " : "− "}{money(transaction.value)}</strong></div>)}{report.actuals.length === 0 && <p className="p-6 text-center text-gray-400">Sem movimentações realizadas no período.</p>}</CardContent></Card>
    </div>
  </Layout>;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
