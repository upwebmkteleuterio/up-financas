import { useMemo, useState } from "react";
import { differenceInCalendarMonths, format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import SearchInput from "@/components/SearchInput";
import OutgoingProgramFormDialog from "@/components/OutgoingProgramFormDialog";
import { useOutgoingPrograms } from "@/hooks/useOutgoingPrograms";
import { OutgoingProgram } from "@/types/finance";
import { Banknote, BriefcaseBusiness, CircleDollarSign, Plus, Wallet } from "lucide-react";
import { createLocalDateFromISO } from "@/lib/utils";

const labelKind = (kind: string) => ({ cost: "Custo", expense: "Gasto", profit: "Saque de Lucro", cash_reserve: "Fundo de Caixa" }[kind] || kind);
const currency = (v?: number | null) => v == null ? "Sem valor" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const kindIcon = (kind: string) => kind === "cost" ? BriefcaseBusiness : kind === "profit" ? CircleDollarSign : kind === "cash_reserve" ? Wallet : Banknote;
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
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const bounds = targetBounds(period, range);
  const filtered = useMemo(() => programs.filter(p =>
    `${p.name} ${p.description || ""}`.toLowerCase().includes(search.toLowerCase())
    && occursInRange(p, bounds)
    && (status === "all" || p.isActive === (status === "active"))
  ), [programs, search, period, range.start?.getTime(), range.end?.getTime(), status]);

  return <Layout pageTitle="Programação Saídas" pageSubtitle="Regras de custos, gastos e demais saídas previstas.">
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-3xl font-bold text-sidebar-primary-foreground">Programação Saídas</h1><p className="mt-1 text-gray-400">Cadastre e mantenha regras de saídas e categorias ativas.</p></div>
        <OutgoingProgramFormDialog trigger={<Button className="bg-green-600 text-white hover:bg-green-700"><Plus className="mr-2 h-4 w-4" />Nova Programação</Button>} />
      </div>
      <Card className="border-sidebar-border bg-sidebar text-sidebar-foreground">
        <CardHeader className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><SearchInput value={search} onChange={setSearch} placeholder="Buscar programação..."/><FilterDropdown activeFilter={period} setActiveFilter={setPeriod} customDateRange={range} setCustomDateRange={setRange}/></div>
          <div className="flex flex-wrap gap-2 pt-3" role="group" aria-label="Filtrar programações por status">
            {([{ value: "all", label: "Todas" }, { value: "active", label: "Ativas" }, { value: "inactive", label: "Inativas" }] as const).map(tab => <Button key={tab.value} type="button" aria-pressed={status === tab.value} variant="outline" className={`border-sidebar-border bg-sidebar-accent/50 text-sidebar-primary-foreground ${status === tab.value ? "border-blue-500 text-blue-400" : ""}`} onClick={() => setStatus(tab.value)}>{tab.label}</Button>)}
          </div>
          <CardTitle className="pt-3 text-xl font-bold">Programações cadastradas ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0"><div className="space-y-1">
          {filtered.map((program: OutgoingProgram) => {
            const Icon = kindIcon(program.kind);
            const schedule = program.frequency === "none" ? "Somente categoria" : program.frequency === "once" ? "Avulsa" : program.frequency === "count" ? `${program.repeatCount} ocorrências mensais` : "Mensal contínua";
            return <div key={program.id} className="flex flex-col border-b border-sidebar-border transition-colors hover:bg-sidebar-accent/30 sm:flex-row sm:items-stretch">
              <OutgoingProgramFormDialog initial={program} trigger={
                <button type="button" className="group flex min-w-0 flex-1 cursor-pointer flex-col justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="shrink-0 rounded-lg bg-blue-900/40 p-2"><Icon className="h-5 w-5 text-blue-400" /></div>
                    <div className="flex min-w-0 flex-col"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold text-sidebar-primary-foreground">{program.name}</span><span className="rounded bg-sidebar-accent/70 px-2 py-0.5 text-xs text-gray-400">{labelKind(program.kind)}</span></div>
                      <span className="mt-1 text-xs text-gray-400">{program.description || "Sem descrição"}</span>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                    <div className="flex flex-col sm:items-end"><strong className="whitespace-nowrap text-sidebar-primary-foreground">{currency(program.value)}</strong><span className="mt-1 text-xs text-gray-400">{schedule}{program.startDate && program.dueDay ? ` · Início ${format(createLocalDateFromISO(program.startDate), "dd/MM/yyyy")} · vence dia ${program.dueDay}` : ""}</span></div>
                  </div>
                </button>
              } />
              <div className="flex shrink-0 items-center gap-2 px-4 pb-4 sm:py-4"><span className="text-xs text-gray-400">{program.isActive ? "Ativa" : "Inativa"}</span><Switch aria-label={`${program.isActive ? "Desativar" : "Ativar"} ${program.name}`} checked={program.isActive} onCheckedChange={checked => saveProgram({ ...program, isActive: checked })} /></div>
            </div>;
          })}
          {filtered.length === 0 && <p className="p-8 text-center text-gray-400">Nenhuma programação encontrada.</p>}
        </div></CardContent>
      </Card>
    </div>
  </Layout>;
}
