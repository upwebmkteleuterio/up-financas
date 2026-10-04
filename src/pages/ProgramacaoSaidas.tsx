import { useMemo, useState } from "react";
import { differenceInCalendarMonths, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import SearchInput from "@/components/SearchInput";
import OutgoingProgramFormDialog from "@/components/OutgoingProgramFormDialog";
import { useOutgoingPrograms } from "@/hooks/useOutgoingPrograms";
import { OutgoingProgram } from "@/types/finance";
import { Plus, Pencil } from "lucide-react";
import { createLocalDateFromISO } from "@/lib/utils";

const labelKind = (kind: string) => ({ cost: "Custo", expense: "Gasto", profit: "Saque de Lucro", cash_reserve: "Fundo de Caixa" }[kind] || kind);
const currency = (v?: number | null) => v == null ? "Sem valor" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
function targetBounds(period: FilterPeriod, custom: { start: Date | undefined; end: Date | undefined }) {
  const now = new Date();
  if (period === "custom" && custom.start && custom.end) return { start: custom.start, end: custom.end };
  if (period === "last_month") { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: startOfMonth(d), end: endOfMonth(d) }; }
  if (period === "next_month") { const d = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { start: startOfMonth(d), end: endOfMonth(d) }; }
  const d = period.startsWith("month_") ? new Date(now.getFullYear(), Number(period.split("_")[1]), 1) : now;
  return { start: startOfMonth(d), end: endOfMonth(d) };
}
function occursInRange(program: OutgoingProgram, range: { start: Date; end: Date }) {
  if (program.frequency === "none") return true;
  if (!program.startDate || !program.dueDay) return false;
  const start = createLocalDateFromISO(program.startDate);
  const firstDue = new Date(start.getFullYear(), start.getMonth(), Math.min(program.dueDay, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
  if (program.frequency === "once") return isWithinInterval(firstDue, range);
  const targetMonth = startOfMonth(range.start);
  const sequence = differenceInCalendarMonths(targetMonth, startOfMonth(start));
  if (sequence < 0 || program.frequency === "count" && sequence >= (program.repeatCount || 0)) return false;
  const target = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(program.dueDay, new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()));
  return target >= firstDue && isWithinInterval(target, range);
}

export default function ProgramacaoSaidas() {
  const { programs, saveProgram } = useOutgoingPrograms();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
  const [range, setRange] = useState<{start: Date | undefined; end: Date | undefined}>({ start: undefined, end: undefined });
  const bounds = targetBounds(period, range);
  const filtered = useMemo(() => programs.filter(p =>
    `${p.name} ${p.description || ""}`.toLowerCase().includes(search.toLowerCase()) && occursInRange(p, bounds)
  ), [programs, search, period, range.start?.getTime(), range.end?.getTime()]);
  return <Layout pageTitle="Programação Saídas" pageSubtitle="Regras de custos, gastos e demais saídas previstas.">
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-3xl font-bold">Programação Saídas</h1><p className="mt-1 text-muted-foreground">Cadastre e mantenha regras de saídas e categorias ativas.</p></div>
        <OutgoingProgramFormDialog trigger={<Button><Plus className="mr-2 h-4 w-4" />Nova Programação</Button>} />
      </div>
      <Card><CardHeader><CardTitle>Programações cadastradas</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><SearchInput value={search} onChange={setSearch} placeholder="Buscar programação..."/><FilterDropdown activeFilter={period} setActiveFilter={setPeriod} customDateRange={range} setCustomDateRange={setRange}/></div>
        <div className="divide-y divide-border">{filtered.map((program: OutgoingProgram) => <div key={program.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate">{program.name}</strong><span className="rounded bg-secondary px-2 py-0.5 text-xs">{labelKind(program.kind)}</span>{!program.isActive && <span className="text-xs text-muted-foreground">Inativa</span>}</div>
            <p className="mt-1 text-sm text-muted-foreground">{program.description || "Sem descrição"} · {program.frequency === "none" ? "Somente categoria" : program.frequency === "once" ? "Avulsa" : program.frequency === "count" ? `${program.repeatCount} ocorrências mensais` : "Mensal contínua"} · {currency(program.value)}</p>
            {program.startDate && program.dueDay && <p className="text-xs text-muted-foreground">Início {program.startDate} · vencimento dia {program.dueDay}</p>}
          </div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Ativa</span><Switch checked={program.isActive} onCheckedChange={checked => saveProgram({ ...program, isActive: checked })}/><OutgoingProgramFormDialog initial={program} trigger={<Button variant="outline" size="icon" aria-label="Editar programação"><Pencil className="h-4 w-4"/></Button>} /></div>
        </div>)}{filtered.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma programação encontrada.</p>}</div>
      </CardContent></Card>
    </div>
  </Layout>;
}
