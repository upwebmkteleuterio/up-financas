import { useEffect, useState } from "react";
import { format } from "date-fns";
import { OutgoingFrequency, OutgoingKind, OutgoingProgram, CostType } from "@/types/finance";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { createLocalDateFromISO } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePartners } from "@/hooks/usePartners";
import { useOutgoingOccurrences, useOutgoingPrograms } from "@/hooks/useOutgoingPrograms";
import { showError } from "@/utils/toast";

const OutgoingProgramFormDialog = ({ trigger, initial }: { trigger: React.ReactNode; initial?: OutgoingProgram }) => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<OutgoingKind>(initial?.kind || "expense");
  const [frequency, setFrequency] = useState<OutgoingFrequency>(initial?.frequency === "count" && initial.repeatCount === 1 ? "once" : initial?.frequency || "monthly");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [hasValue, setHasValue] = useState(initial?.value != null);
  const { displayValue, numericValue, handleChange, setNumericValue } = useCurrencyInput(initial?.value ?? 0);
  const [costType, setCostType] = useState<CostType>(initial?.costType || "Fixo");
  const [startDate, setStartDate] = useState(initial?.startDate || format(new Date(), "yyyy-MM-dd"));
  const [dueDay, setDueDay] = useState(String(initial?.dueDay || new Date().getDate()));
  const [repeatCount, setRepeatCount] = useState(String(initial?.repeatCount || 2));
  const [partnerId, setPartnerId] = useState(initial?.partnerId || "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const { partners } = usePartners();
  const { saveProgram } = useOutgoingPrograms();
  const { occurrences } = useOutgoingOccurrences();
  const hasPersistedOccurrences = !!initial && occurrences.some(occurrence => occurrence.programId === initial.id && !!occurrence.id);
  const needsSchedule = frequency !== "none";
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const scheduledValue = hasValue ? numericValue : null;
    if (scheduledValue !== null && (!Number.isFinite(scheduledValue) || scheduledValue <= 0)) {
      showError("Informe um valor previsto válido.");
      return;
    }
    if (needsSchedule && !initial && (scheduledValue === null || scheduledValue <= 0)) {
      showError("Informe um valor maior que zero para gerar vencimentos.");
      return;
    }
    if (needsSchedule && (Number(dueDay) < 1 || Number(dueDay) > 31)) {
      showError("O dia do vencimento deve estar entre 1 e 31.");
      return;
    }
    if (frequency === "count" && (!Number.isInteger(Number(repeatCount)) || Number(repeatCount) < 1)) {
      showError("Informe uma quantidade inteira de ocorrências.");
      return;
    }
    const savedFrequency = frequency === "count" && Number(repeatCount) === 1 ? "once" : frequency;
    await saveProgram({
      ...(initial ? { id: initial.id } : {}), kind, name: name.trim(), description: description.trim() || null,
      value: scheduledValue,
      costType: kind === "cost" ? costType : null, frequency: savedFrequency,
      startDate: needsSchedule ? startDate : null, dueDay: needsSchedule ? Number(dueDay) : null,
      repeatCount: savedFrequency === "count" ? Number(repeatCount) : null,
      partnerId: kind === "profit" ? partnerId || null : null,
      historicalNames: initial?.kind === "cost" && initial.name !== name.trim()
        ? Array.from(new Set([...(initial.historicalNames || []), initial.name]))
        : initial?.historicalNames,
      isActive,
    });
    setOpen(false);
  };
  useEffect(() => {
    if (open) {
      setKind(initial?.kind || "expense"); setFrequency(initial?.frequency === "count" && initial.repeatCount === 1 ? "once" : initial?.frequency || "monthly"); setName(initial?.name || "");
      setDescription(initial?.description || ""); setHasValue(initial?.value != null); setNumericValue(initial?.value ?? 0);
      setCostType(initial?.costType || "Fixo"); setStartDate(initial?.startDate || format(new Date(), "yyyy-MM-dd"));
      setDueDay(String(initial?.dueDay || new Date().getDate())); setRepeatCount(String(initial?.repeatCount || 2));
      setPartnerId(initial?.partnerId || ""); setIsActive(initial?.isActive ?? true);
    }
  }, [open, initial, setNumericValue]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground">
    <DialogHeader><DialogTitle>{initial ? "Editar Programação" : "Nova Programação"}</DialogTitle></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label>Tipo *</Label><Select value={kind} onValueChange={(v: OutgoingKind) => setKind(v)} disabled={!!initial}><SelectTrigger className="bg-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cost">Custo</SelectItem><SelectItem value="expense">Gasto</SelectItem><SelectItem value="profit">Saque de Lucro</SelectItem><SelectItem value="cash_reserve">Fundo de Caixa</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Frequência</Label><Select value={frequency} onValueChange={(v: OutgoingFrequency) => setFrequency(v)} disabled={hasPersistedOccurrences}><SelectTrigger className="bg-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal contínua</SelectItem><SelectItem value="once">Avulsa</SelectItem><SelectItem value="count">Repetição finita</SelectItem><SelectItem value="none">Somente categoria, sem vencimentos</SelectItem></SelectContent></Select>{hasPersistedOccurrences && <p className="text-xs text-muted-foreground">A recorrência não pode ser alterada após registrar ocorrências.</p>}</div>
      </div>
      <div className="space-y-2"><Label>Nome *</Label><Input className="bg-input" required value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="space-y-2"><Label>Descrição</Label><Textarea className="bg-input" value={description} onChange={e => setDescription(e.target.value)} /></div>
      {kind === "cost" && <div className="space-y-2"><Label>Tipo de custo</Label><Select value={costType} onValueChange={(v: CostType) => setCostType(v)}><SelectTrigger className="bg-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Fixo">Fixo</SelectItem><SelectItem value="Variável">Variável</SelectItem></SelectContent></Select></div>}
      {kind === "profit" && <div className="space-y-2"><Label>Sócio</Label><Select value={partnerId} onValueChange={setPartnerId}><SelectTrigger className="bg-input"><SelectValue placeholder="Selecione o sócio" /></SelectTrigger><SelectContent>{partners.filter(p => p.isActive).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>}
      <div className="space-y-2"><Label>Valor previsto (R$)</Label><Input className="bg-input" inputMode="decimal" value={hasValue ? `R$ ${displayValue}` : ""} onChange={event => { handleChange(event); setHasValue(event.target.value.replace(/\D/g, "").length > 0); }} /></div>
      {needsSchedule && <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Início</Label><DatePicker date={createLocalDateFromISO(startDate)} setDate={date => date && setStartDate(format(date, "yyyy-MM-dd"))} disabled={hasPersistedOccurrences} /></div><div className="space-y-2"><Label>Dia do vencimento</Label><Input className="bg-input" type="number" min="1" max="31" required value={dueDay} disabled={hasPersistedOccurrences} onChange={e => setDueDay(e.target.value)} /></div></div>}
      {frequency === "count" && <div className="space-y-2"><Label>Quantidade de meses</Label><Input className="bg-input" type="number" min="2" step="1" required value={repeatCount} disabled={hasPersistedOccurrences} onChange={e => { setRepeatCount(e.target.value); if (Number(e.target.value) === 1) setFrequency("once"); }} /></div>}
      <div className="mt-4 flex items-center justify-between rounded-md bg-secondary/50 p-3"><Label htmlFor="outgoing-program-active" className="text-base font-medium">Ativa para novas ocorrências</Label><Switch id="outgoing-program-active" checked={isActive} onCheckedChange={setIsActive} /></div>
      <DialogFooter><Button type="submit" className="w-full" disabled={!name.trim() || (kind === "profit" && !partnerId)}>Salvar programação</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
};
export default OutgoingProgramFormDialog;
