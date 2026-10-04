import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { CalendarDays, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { OutgoingOccurrence, OutgoingProgram, PaymentMethod } from "@/types/finance";
import { useOutgoingOccurrences } from "@/hooks/useOutgoingPrograms";
import { createLocalDateFromISO } from "@/lib/utils";
import { showError } from "@/utils/toast";

export default function ConfirmOutgoingDialog({ occurrence, program, nextDueDate, trigger }: { occurrence: OutgoingOccurrence; program: OutgoingProgram; nextDueDate?: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [actualDate, setActualDate] = useState(occurrence.dueDate);
  const [method, setMethod] = useState<PaymentMethod>("Pix");
  const [partialAction, setPartialAction] = useState<"new_date" | "add_to_next">("new_date");
  const [residualDate, setResidualDate] = useState("");
  const [description, setDescription] = useState(program.description || program.name);
  const [saving, setSaving] = useState(false);
  const { displayValue, numericValue, handleChange, setNumericValue } = useCurrencyInput(occurrence.scheduledValue);
  const { confirm } = useOutgoingOccurrences();
  const partial = numericValue > 0 && numericValue < occurrence.scheduledValue;
  const earliestResidualDate = actualDate ? format(addDays(createLocalDateFromISO(actualDate), 1), "yyyy-MM-dd") : "";
  const invalidResidualDate = partial && partialAction === "new_date" && (!residualDate || residualDate <= actualDate);
  const formatCurrency = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(occurrence.scheduledValue), [occurrence.scheduledValue]);
  const reset = () => { setActualDate(occurrence.dueDate); setMethod("Pix"); setPartialAction("new_date"); setResidualDate(""); setDescription(program.description || program.name); setNumericValue(occurrence.scheduledValue); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericValue <= 0 || !actualDate || invalidResidualDate) return;
    setSaving(true);
    try {
      await confirm({ occurrence, actualValue: numericValue, actualDate, paymentMethod: method, description: description.trim() || program.name,
        partialAction: partial ? partialAction : undefined, residualDueDate: partial && partialAction === "new_date" ? residualDate : undefined,
        nextDueDate: partial && partialAction === "add_to_next" ? nextDueDate : undefined });
      setOpen(false);
    } catch (error) { showError(error instanceof Error ? error.message : "Não foi possível confirmar o pagamento."); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) reset(); }}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground">
    <DialogHeader><DialogTitle className="flex items-center gap-2 text-green-500"><CheckCircle className="h-5 w-5"/>Confirmar pagamento</DialogTitle><DialogDescription>{program.name} · previsto {formatCurrency}</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label>Valor real</Label><Input className="bg-input" inputMode="decimal" value={`R$ ${displayValue}`} onChange={handleChange} required /></div>
      <div className="space-y-2"><Label>Data do pagamento</Label><Input className="bg-input" type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Forma de pagamento</Label><Select value={method} onValueChange={(v: PaymentMethod) => setMethod(v)}><SelectTrigger className="bg-input"><SelectValue /></SelectTrigger><SelectContent>{(["Pix", "Parcelado", "Dinheiro", "Cartão", "Transferência"] as PaymentMethod[]).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Descrição da transação</Label><Input className="bg-input" value={description} onChange={e => setDescription(e.target.value)} /></div>
      {partial && <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4"><p className="text-sm">Saldo restante: R$ {(occurrence.scheduledValue - numericValue).toFixed(2)}</p>
        <RadioGroup value={partialAction} onValueChange={(v: "new_date" | "add_to_next") => setPartialAction(v)}><div className="flex items-center gap-2"><RadioGroupItem value="new_date" id="residual-new"/><Label htmlFor="residual-new">Criar resíduo em nova data</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="add_to_next" id="residual-next" disabled={!nextDueDate}/><Label htmlFor="residual-next" className={!nextDueDate ? "text-muted-foreground" : ""}>Somar à próxima ocorrência existente {!nextDueDate && "(indisponível)"}</Label></div></RadioGroup>
        {partialAction === "new_date" && <div className="space-y-2"><Label>Vencimento do resíduo</Label><Input className="bg-input" type="date" min={earliestResidualDate} value={residualDate} onChange={e => setResidualDate(e.target.value)} required />{residualDate && residualDate <= actualDate && <p className="text-sm text-destructive">A data do resíduo deve ser posterior ao pagamento.</p>}</div>}
      </div>}
      <DialogFooter><Button type="submit" disabled={saving || numericValue <= 0 || invalidResidualDate}><CalendarDays className="mr-2 h-4 w-4"/>{saving ? "Confirmando..." : "Confirmar pagamento"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
