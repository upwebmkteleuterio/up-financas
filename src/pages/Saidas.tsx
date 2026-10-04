import { useMemo, useState } from "react";
import { addWeeks, endOfMonth, endOfWeek, format, isWithinInterval, startOfMonth, startOfWeek, subWeeks } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import SearchInput from "@/components/SearchInput";
import ConfirmOutgoingDialog from "@/components/ConfirmOutgoingDialog";
import { makeOutgoingOccurrence, useOutgoingOccurrences } from "@/hooks/useOutgoingPrograms";
import { OutgoingOccurrenceWithProgram } from "@/hooks/useOutgoingPrograms";
import { CheckCircle, CircleDollarSign } from "lucide-react";
import { createLocalDateFromISO } from "@/lib/utils";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
function periodBounds(period: FilterPeriod, custom: {start: Date | undefined; end: Date | undefined}) {
  const now = new Date();
  if (period === "custom" && custom.start && custom.end) return { start: custom.start, end: custom.end };
  if (period === "current_week") return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  if (period === "next_week") { const date = addWeeks(now, 1); return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }; }
  if (period === "last_week") { const date = subWeeks(now, 1); return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }; }
  if (period === "last_month") { const date = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: startOfMonth(date), end: endOfMonth(date) }; }
  if (period === "next_month") { const date = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { start: startOfMonth(date), end: endOfMonth(date) }; }
  if (period.startsWith("month_")) { const date = new Date(now.getFullYear(), Number(period.split("_")[1]), 1); return { start: startOfMonth(date), end: endOfMonth(date) }; }
  return { start: startOfMonth(now), end: endOfMonth(now) };
}
export default function Saidas() {
  const [period, setPeriod] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [custom, setCustom] = useState<{start: Date | undefined; end: Date | undefined}>({start: undefined, end: undefined});
  const [search, setSearch] = useState("");
  const bounds = periodBounds(period, custom);
  const { pending, occurrences } = useOutgoingOccurrences(bounds);
  const items = useMemo(() => pending.filter((item: OutgoingOccurrenceWithProgram) => {
    const program = item.program;
    if (!program) return false;
    const matches = `${program.name} ${program.description || ""}`.toLowerCase().includes(search.toLowerCase());
    return matches && isWithinInterval(createLocalDateFromISO(item.dueDate), bounds);
  }), [pending, search, bounds.start.getTime(), bounds.end.getTime()]);
  return <Layout pageTitle="Saídas" pageSubtitle="Ocorrências previstas e confirmação de pagamentos.">
    <div className="space-y-6"><div><h1 className="text-3xl font-bold text-sidebar-primary-foreground">Saídas</h1><p className="mt-1 text-gray-400">Acompanhe vencimentos pendentes e registre pagamentos.</p></div>
      <Card className="border-sidebar-border bg-sidebar text-sidebar-foreground"><CardHeader><CardTitle>Ocorrências pendentes</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><SearchInput value={search} onChange={setSearch} placeholder="Buscar saída..."/><FilterDropdown activeFilter={period} setActiveFilter={setPeriod} customDateRange={custom} setCustomDateRange={setCustom}/></div>
        <div className="space-y-1">{items.map((item: OutgoingOccurrenceWithProgram) => {
          const program = item.program!;
          const nextSequence = item.sequenceNumber === null ? null : item.sequenceNumber + 1;
          const nextRuleOccurrence = nextSequence !== null && program.isActive
            && (program.frequency === "monthly" || program.frequency === "count" && nextSequence < (program.repeatCount || 0))
            ? makeOutgoingOccurrence(program, nextSequence)
            : null;
          const persistedNext = nextSequence === null ? undefined : occurrences.find(o => o.id && o.programId === item.programId && o.sequenceNumber === nextSequence);
          const nextDue = nextRuleOccurrence && (!persistedNext || persistedNext.status === "pending" && persistedNext.dueDate === nextRuleOccurrence.dueDate)
            ? nextRuleOccurrence.dueDate
            : undefined;
          return <div key={item.id || `${item.programId}-${item.sequenceNumber}-${item.dueDate}`} className="group flex flex-col justify-between gap-3 border-b border-sidebar-border p-4 transition-colors hover:bg-sidebar-accent/30 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-4"><div className={`mt-1 shrink-0 rounded-lg p-2 ${item.isResidual ? "bg-amber-900/30" : "bg-red-900/30"}`}><CircleDollarSign className={`h-5 w-5 ${item.isResidual ? "text-amber-400" : "text-red-400"}`}/></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sidebar-primary-foreground">{program.name}</strong>{item.isResidual && <span className="rounded border border-amber-500/50 px-2 py-0.5 text-xs text-amber-400">Resíduo</span>}{!program.isActive && <span className="text-xs text-gray-400">Programa inativo</span>}</div><p className="mt-1 text-sm text-gray-400">Vencimento {format(createLocalDateFromISO(item.dueDate), "dd/MM/yyyy")} · {program.kind === "cost" ? "Custo" : program.kind === "expense" ? "Gasto" : program.kind === "profit" ? "Saque de lucro" : "Fundo de Caixa"}</p></div></div>
            <div className="flex items-center justify-between gap-4 sm:justify-end"><strong className="whitespace-nowrap text-sidebar-primary-foreground">{money(item.scheduledValue)}</strong><ConfirmOutgoingDialog occurrence={item} program={program} nextDueDate={nextDue} trigger={<Button size="sm" className="bg-green-600 text-white hover:bg-green-700"><CheckCircle className="mr-2 h-4 w-4"/>Confirmar</Button>}/></div>
          </div>;
        })}{items.length === 0 && <p className="p-8 text-center text-gray-400">Nenhuma saída pendente neste período.</p>}</div>
      </CardContent></Card>
    </div>
  </Layout>;
}
