import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileText, Filter, Loader2, Save, Trash2, Upload } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Layout from "@/components/Layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCosts } from "@/hooks/useCosts";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { usePartners } from "@/hooks/usePartners";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { keysToCamelCase, keysToSnakeCase } from "@/lib/utils";
import { subcategories } from "@/types/finance";
import { showSuccess } from "@/utils/toast";
import { ExtratoTransacao, parseRecargaPayPdf } from "@/lib/pdf-import/recargapayParser";
import PdfImportItemRow, { ImportDraft } from "@/components/pdf-import/PdfImportItemRow";
import PdfImportSettingsDialog, { ImportSettings } from "@/components/pdf-import/PdfImportSettingsDialog";

const parseValue = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

type ExistingTransaction = {
  pdf_external_id: string | null;
  date: string;
  value: number;
  description: string;
  category: string;
};

const itemToDraft = (item: any): ImportDraft => ({
  id: item.id,
  batchId: item.batchId,
  externalId: item.pdfExternalId || "",
  date: item.date || "",
  type: item.type,
  subgroup: item.subgroup || (item.type === "Entrada" ? "Entrada" : "Gasto"),
  category: item.category || "",
  description: item.description || "",
  value: Number(item.value || 0).toFixed(2).replace(".", ","),
  paymentMethod: item.paymentMethod || "Pix",
  notes: item.notes || "",
  partnerId: item.partnerId || undefined,
  rawText: item.rawText || "",
  page: item.page,
  duplicate: item.isDuplicate || false,
  duplicateType: item.duplicateType,
  duplicateTransaction: item.duplicateTransaction,
  saved: true,
});

const ImportarPdf = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { costCategories } = useCosts();
  const { expenseCategories } = useExpenseCategories();
  const { partners } = usePartners();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importListRef = useRef<HTMLDivElement>(null);
  const savingIdsRef = useRef(new Set<string>());
  const [fileName, setFileName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [individualDuplicateOpen, setIndividualDuplicateOpen] = useState(false);
  const [individualDuplicateDraft, setIndividualDuplicateDraft] = useState<ImportDraft | null>(null);
  const [excludedDuplicateIds, setExcludedDuplicateIds] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [settings, setSettings] = useState<ImportSettings>({ defaultEntrySubgroup: "Outras Entradas", defaultExitSubgroup: "Gasto" });
  const [typeFilter, setTypeFilter] = useState<"Todos" | "Entrada" | "Saída">("Todos");
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();

  const costNames = useMemo(() => costCategories.filter((category) => category.isActive).map((category) => category.name), [costCategories]);
  const expenseNames = useMemo(() => expenseCategories.map((category) => category.name), [expenseCategories]);
  const activePartners = useMemo(() => partners.filter((partner) => partner.isActive), [partners]);
  const enrichDuplicateStatus = useCallback(async (items: ImportDraft[]): Promise<ImportDraft[]> => {
    if (!user || items.length === 0) return items;
    const ids = [...new Set(items.map((item) => item.externalId).filter(Boolean))];
    const dates = items.map((item) => item.date).filter(Boolean).sort();
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.externalId, (counts.get(item.externalId) || 0) + 1));

    const idQuery = ids.length
      ? supabase.from("transactions").select("pdf_external_id, date, value, description, category").eq("user_id", user.id).in("pdf_external_id", ids)
      : Promise.resolve({ data: [], error: null });
    const dateQuery = dates.length
      ? supabase.from("transactions").select("pdf_external_id, date, value, description, category").eq("user_id", user.id).gte("date", dates[0]).lte("date", dates[dates.length - 1])
      : Promise.resolve({ data: [], error: null });
    const [idResult, dateResult] = await Promise.all([idQuery, dateQuery]);
    if (idResult.error) throw idResult.error;
    if (dateResult.error) throw dateResult.error;

    const byId = new Map((idResult.data as ExistingTransaction[]).map((transaction) => [transaction.pdf_external_id, transaction]));
    const byDateValue = new Map((dateResult.data as ExistingTransaction[]).map((transaction) => [`${transaction.date}|${Number(transaction.value).toFixed(2)}`, transaction]));
    return items.map((item) => {
      const hasPdfIdDuplicate = Boolean(item.externalId && (byId.has(item.externalId) || (counts.get(item.externalId) || 0) > 1));
      const byValue = byDateValue.get(`${item.date}|${parseValue(item.value).toFixed(2)}`);
      const duplicateType = hasPdfIdDuplicate ? "pdf_id" : byValue ? "date_value" : undefined;
      return {
        ...item,
        duplicate: Boolean(duplicateType),
        duplicateType,
        duplicateTransaction: byValue ? { description: byValue.description, category: byValue.category } : undefined,
      };
    });
  }, [user]);

  const filteredDrafts = drafts.filter((draft) => {
    const matchesType = typeFilter === "Todos" || draft.type === typeFilter;
    const itemDate = draft.date ? new Date(`${draft.date}T00:00:00`) : undefined;
    const matchesStart = !dateStart || (itemDate && itemDate >= dateStart);
    const matchesEnd = !dateEnd || (itemDate && itemDate <= new Date(dateEnd.getFullYear(), dateEnd.getMonth(), dateEnd.getDate(), 23, 59, 59));
    return matchesType && matchesStart && matchesEnd;
  });
  const pendingDrafts = drafts.filter((draft) => !draft.saved);
  const pendingCount = drafts.filter((draft) => !draft.category || !draft.description.trim() || !draft.date || parseValue(draft.value) <= 0).length;
  const pdfDuplicateCount = drafts.filter((draft) => draft.duplicateType === "pdf_id").length;
  const possibleDuplicateDrafts = drafts.filter((draft) => draft.duplicateType === "date_value");
  const duplicateCount = pdfDuplicateCount + possibleDuplicateDrafts.length;
  const importableDrafts = drafts.filter((draft) => draft.duplicateType !== "pdf_id" && !(draft.duplicateType === "date_value" && excludedDuplicateIds.has(draft.id)));
  const entriesTotal = drafts.filter((draft) => draft.type === "Entrada").reduce((sum, draft) => sum + parseValue(draft.value), 0);
  const exitsTotal = drafts.filter((draft) => draft.type === "Saída").reduce((sum, draft) => sum + parseValue(draft.value), 0);
  const rowVirtualizer = useVirtualizer({ count: filteredDrafts.length, getScrollElement: () => importListRef.current, estimateSize: () => 230, overscan: 4 });

  const removeDraft = async (id: string) => {
    const { error } = await supabase.from("transaction_import_items").delete().eq("id", id).eq("user_id", user?.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setDrafts((current) => current.filter((item) => item.id !== id));
  };

  const discardBatch = async () => {
    if (!user || !batchId || !window.confirm("Descartar este rascunho e todos os itens ainda não importados?")) return;
    const { error } = await supabase.from("transaction_import_batches").delete().eq("id", batchId).eq("user_id", user.id).eq("status", "reviewing");
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setDrafts([]);
    setBatchId("");
    setFileName("");
    setRecovered(false);
  };

  const saveDraft = useCallback(async (draft: ImportDraft) => {
    if (!user || draft.saved || savingIdsRef.current.has(draft.id)) return;
    savingIdsRef.current.add(draft.id);
    setSavingIds((current) => new Set(current).add(draft.id));
    try {
      const { error } = await supabase.from("transaction_import_items").update(keysToSnakeCase({
        pdfExternalId: draft.externalId || null,
        type: draft.type,
        subgroup: draft.subgroup,
        category: draft.category || null,
        description: draft.description,
        value: parseValue(draft.value),
        date: draft.date || null,
        paymentMethod: draft.paymentMethod,
        notes: draft.notes || null,
        partnerId: draft.partnerId || null,
        status: "pending",
        updatedAt: new Date().toISOString(),
      })).eq("id", draft.id).eq("user_id", user.id);
      if (error) throw error;
      setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, ...draft, saved: true } : item));
    } catch (error: any) {
      setErrorMessage(error.message || "Não foi possível salvar este lançamento.");
    } finally {
      savingIdsRef.current.delete(draft.id);
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(draft.id);
        return next;
      });
    }
  }, [user]);

  const handleSavePending = async () => {
    setIsSaving(true);
    for (const draft of pendingDrafts) await saveDraft(draft);
    setIsSaving(false);
  };

  const loadExistingBatch = useCallback(async () => {
    if (!user) return;
    const { data: savedSettings } = await supabase.from("transaction_import_settings").select("default_entry_subgroup, default_exit_subgroup, default_profit_partner_id").eq("user_id", user.id).maybeSingle();
    if (savedSettings) setSettings({ defaultEntrySubgroup: savedSettings.default_entry_subgroup || "Outras Entradas", defaultExitSubgroup: savedSettings.default_exit_subgroup, defaultProfitPartnerId: savedSettings.default_profit_partner_id || undefined });
    const { data: batches } = await supabase.from("transaction_import_batches").select("id, file_name").eq("user_id", user.id).eq("status", "reviewing").order("created_at", { ascending: false }).limit(1);
    const batch = batches?.[0];
    if (!batch) return;
    const { data: items, error } = await supabase.from("transaction_import_items").select("*").eq("batch_id", batch.id).eq("user_id", user.id).eq("status", "pending").order("sequence_number", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).order("id", { ascending: true });
    if (error || !items?.length) return;
    const recoveredDrafts = await enrichDuplicateStatus(items.map((item) => itemToDraft(keysToCamelCase(item))));
    setBatchId(batch.id);
    setFileName(batch.file_name);
    setDrafts(recoveredDrafts);
    setRecovered(true);
  }, [enrichDuplicateStatus, user]);

  useEffect(() => { loadExistingBatch(); }, [loadExistingBatch]);

  const handleFile = async (file?: File) => {
    if (!file || !user) return;
    setErrorMessage("");
    if (file.type !== "application/pdf") {
      setErrorMessage("Selecione um arquivo PDF válido.");
      return;
    }
    setIsReading(true);
    setFileName(file.name);
    try {
      const parsed = await parseRecargaPayPdf(file);
      if (parsed.length === 0) throw new Error("Nenhum lançamento reconhecido no PDF.");
      const { data: batch, error: batchError } = await supabase.from("transaction_import_batches").insert({ user_id: user.id, source: "pdf_recargapay", file_name: file.name, status: "reviewing", total_detected: parsed.length, total_imported: 0 }).select("id").single();
      if (batchError) throw batchError;
      const rows = parsed.map((item: ExtratoTransacao) => keysToSnakeCase({
        batchId: batch.id,
        userId: user.id,
        sequenceNumber: parsed.indexOf(item),
        pdfExternalId: item.idExterno,
        type: item.tipo === "entrada" ? "Entrada" : "Saída",
        subgroup: item.tipo === "entrada" ? "Entrada" : settings.defaultExitSubgroup,
        category: item.tipo === "entrada" ? settings.defaultEntrySubgroup : settings.defaultExitSubgroup === "Gasto" ? expenseNames[0] || null : settings.defaultExitSubgroup === "Custo" ? costNames[0] || null : settings.defaultExitSubgroup === "Saque" ? "Saque de Lucro" : "Fundo de Caixa",
        partnerId: item.tipo === "saida" && settings.defaultExitSubgroup === "Saque" ? settings.defaultProfitPartnerId || null : null,
        description: item.descricao,
        value: item.valor,
        date: item.data,
        paymentMethod: "Pix",
        rawText: item.rawText || null,
        page: item.pagina || null,
        isDuplicate: false,
        status: "pending",
      }));
      const { data: inserted, error: itemError } = await supabase.from("transaction_import_items").insert(rows).select("*");
      if (itemError) throw itemError;
      const parsedDrafts = (inserted || []).map((item) => itemToDraft(keysToCamelCase(item)));
      const enrichedDrafts = await enrichDuplicateStatus(parsedDrafts);
      setBatchId(batch.id);
      setDrafts(enrichedDrafts);
      setRecovered(false);
    } catch (error: any) {
      setDrafts([]);
      setErrorMessage(error.message || "Não foi possível ler o PDF.");
    } finally {
      setIsReading(false);
    }
  };

  const performIndividualImport = async (draft: ImportDraft) => {
    if (!user) return;
    const { data: insertedTransaction, error: transactionError } = await supabase.rpc("create_transaction", { p_transaction: keysToSnakeCase({ type: draft.type, category: draft.category, description: draft.description.trim(), value: parseValue(draft.value), date: draft.date, paymentMethod: draft.paymentMethod, notes: draft.notes.trim() || null, partnerId: draft.partnerId || null, accountType: "main", isTransfer: false, pdfExternalId: draft.externalId, importBatchId: batchId, importSource: "pdf_recargapay", importFileName: fileName, importedAt: new Date().toISOString(), rawText: draft.rawText, createdSource: "pdf", operationId: `pdf:${batchId}:${draft.id}` }), p_operation_id: `pdf:${batchId}:${draft.id}` });
    if (transactionError || !insertedTransaction?.id) { setErrorMessage(transactionError?.message || "O lançamento não foi confirmado no financeiro."); return; }
    const { data: updatedItem, error: itemError } = await supabase.from("transaction_import_items").update({ status: "migrated", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("user_id", user.id).eq("status", "pending").select("id").single();
    if (itemError || !updatedItem?.id) { setErrorMessage(itemError?.message || "O lançamento foi salvo, mas não foi possível atualizar o rascunho."); return; }
    setDrafts((current) => current.filter((item) => item.id !== draft.id));
    showSuccess("Lançamento importado com sucesso.");
  };

  const importIndividual = async (draft: ImportDraft) => {
    if (!user || !draft.saved || !draft.category || !draft.description.trim() || parseValue(draft.value) <= 0) {
      setErrorMessage("Salve e complete este lançamento antes de importá-lo.");
      return;
    }
    if (draft.duplicateType === "pdf_id") {
      setErrorMessage("Este ID do PDF já foi importado e não pode ser importado novamente.");
      return;
    }
    if (draft.duplicateType === "date_value") {
      setIndividualDuplicateDraft(draft);
      setIndividualDuplicateOpen(true);
      return;
    }
    await performIndividualImport(draft);
  };

  const requestFinalize = () => {
    if (!user || !batchId || drafts.length === 0) return;
    if (pendingCount > 0 || pendingDrafts.length > 0) {
      setErrorMessage("Salve as alterações pendentes e corrija os campos obrigatórios antes de concluir.");
      return;
    }
    setExcludedDuplicateIds(new Set());
    if (possibleDuplicateDrafts.length > 0) {
      setDuplicateReviewOpen(true);
      return;
    }
    setImportProgress({ current: 0, total: importableDrafts.length });
    setConfirmFinalizeOpen(true);
  };

  const continueAfterDuplicateReview = () => {
    setDuplicateReviewOpen(false);
    setImportProgress({ current: 0, total: importableDrafts.length });
    setConfirmFinalizeOpen(true);
  };

  const handleFinalize = async () => {
    if (!user || !batchId || drafts.length === 0) return;
    setIsSaving(true);
    setErrorMessage("");
    const skippedDrafts = drafts.filter((draft) => draft.duplicateType === "pdf_id" || (draft.duplicateType === "date_value" && excludedDuplicateIds.has(draft.id)));
    const draftsToImport = drafts.filter((draft) => !skippedDrafts.some((skipped) => skipped.id === draft.id));
    const total = draftsToImport.length;
    setImportProgress({ current: 0, total });
    try {
      if (skippedDrafts.length > 0) {
        const { error: skippedError } = await supabase.from("transaction_import_items").update({ status: "skipped", updated_at: new Date().toISOString() }).in("id", skippedDrafts.map((draft) => draft.id)).eq("batch_id", batchId).eq("user_id", user.id).eq("status", "pending");
        if (skippedError) throw skippedError;
      }
      for (const [index, draft] of draftsToImport.entries()) {
        const { error: transactionError } = await supabase.rpc("create_transaction", { p_transaction: keysToSnakeCase({ type: draft.type, category: draft.category, description: draft.description.trim(), value: parseValue(draft.value), date: draft.date, paymentMethod: draft.paymentMethod, notes: draft.notes.trim() || null, partnerId: draft.partnerId || null, accountType: "main", isTransfer: false, pdfExternalId: draft.externalId, importBatchId: batchId, importSource: "pdf_recargapay", importFileName: fileName, importedAt: new Date().toISOString(), rawText: draft.rawText, createdSource: "pdf", operationId: `pdf:${batchId}:${draft.id}` }), p_operation_id: `pdf:${batchId}:${draft.id}` });
        if (transactionError) throw transactionError;
        const { error: itemError } = await supabase.from("transaction_import_items").update({ status: "migrated", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("batch_id", batchId).eq("user_id", user.id).eq("status", "pending");
        if (itemError) throw itemError;
        setImportProgress({ current: index + 1, total });
      }
      const { error: batchError } = await supabase.from("transaction_import_batches").update({ status: "completed", total_imported: total }).eq("id", batchId).eq("user_id", user.id);
      if (batchError) throw batchError;
      showSuccess(`${total} lançamento(s) importado(s) com sucesso. ${skippedDrafts.length} ignorado(s) por duplicidade.`);
      setConfirmFinalizeOpen(false);
      navigate("/financeiro");
    } catch (error: any) {
      setErrorMessage(error.message || "Não foi possível concluir a importação.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout pageTitle="Importar PDF" pageSubtitle="Revise os lançamentos antes de salvar no financeiro">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Button asChild variant="outline"><Link to="/financeiro"><ArrowLeft className="mr-2 h-4 w-4" />Financeiro</Link></Button><div><h1 className="text-2xl font-bold">Importação de PDF</h1><p className="text-sm text-muted-foreground">Edite os dados e salve o rascunho antes de concluir.</p></div></div><div className="flex gap-2"><PdfImportSettingsDialog userId={user?.id} activePartners={activePartners} onSaved={setSettings} /><Button variant="outline" onClick={discardBatch} disabled={!batchId || drafts.length === 0}><Trash2 className="mr-2 h-4 w-4" />Limpar rascunho</Button><Button onClick={() => fileInputRef.current?.click()} disabled={isReading}><Upload className="mr-2 h-4 w-4" />Selecionar PDF</Button></div><input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} /></div>
        {recovered && <Alert><AlertDescription>Encontramos uma importação pendente e recuperamos seus dados salvos.</AlertDescription></Alert>}
        {errorMessage && <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>}
        <Card><CardContent className="flex flex-wrap items-center gap-4 p-4"><FileText className="h-8 w-8 text-primary" /><div className="min-w-48 flex-1"><p className="font-medium">{fileName || "Nenhum arquivo selecionado"}</p><p className="text-sm text-muted-foreground">{isReading ? "Lendo páginas do PDF..." : drafts.length ? `${drafts.length} lançamento(s) em revisão` : "Os dados editados ficam salvos online neste lote."}</p></div>{isReading && <Loader2 className="h-5 w-5 animate-spin" />}</CardContent></Card>
        {drafts.length > 0 && <>
          <div className="grid gap-4 md:grid-cols-4"><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Lançamentos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{drafts.length}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Entradas</CardTitle></CardHeader><CardContent className="text-xl font-bold text-green-500">R$ {entriesTotal.toFixed(2).replace(".", ",")}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Saídas</CardTitle></CardHeader><CardContent className="text-xl font-bold text-red-500">R$ {exitsTotal.toFixed(2).replace(".", ",")}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pendências</CardTitle></CardHeader><CardContent className="text-xl font-bold text-yellow-500">{pendingCount + duplicateCount}</CardContent></Card></div>
          <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Conferência dos lançamentos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Clique fora de um campo para salvar automaticamente.</p></div><div className="flex gap-2"><Sheet><SheetTrigger asChild><Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filtros</Button></SheetTrigger><SheetContent side="right"><SheetHeader><SheetTitle>Filtrar lançamentos</SheetTitle></SheetHeader><div className="space-y-5 py-6"><div className="space-y-2"><Label>Tipo</Label><Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "Todos" | "Entrada" | "Saída")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todos">Todos</SelectItem><SelectItem value="Entrada">Apenas entradas</SelectItem><SelectItem value="Saída">Apenas saídas</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Data inicial</Label><DatePicker date={dateStart} setDate={setDateStart} placeholder="Data inicial" /></div><div className="space-y-2"><Label>Data final</Label><DatePicker date={dateEnd} setDate={setDateEnd} placeholder="Data final" /></div><Button variant="outline" className="w-full" onClick={() => { setTypeFilter("Todos"); setDateStart(undefined); setDateEnd(undefined); }}>Limpar filtros</Button></div></SheetContent></Sheet><Button variant="outline" onClick={handleSavePending} disabled={isSaving || pendingDrafts.length === 0}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{pendingDrafts.length === 0 ? "Tudo salvo" : `Salvar ${pendingDrafts.length} pendente(s)`}</Button><Button onClick={requestFinalize} disabled={isSaving || pendingCount > 0 || pendingDrafts.length > 0}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir importação</Button></div></div></CardHeader><CardContent><div ref={importListRef} className="h-[min(72vh,900px)] overflow-y-auto pr-2"><div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => { const draft = filteredDrafts[virtualRow.index]; return <div key={draft.id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="absolute left-0 top-0 w-full pb-4" style={{ transform: `translateY(${virtualRow.start}px)` }}><PdfImportItemRow draft={draft} costNames={costNames} expenseNames={expenseNames} activePartners={activePartners} userId={user?.id} saving={savingIds.has(draft.id)} onSave={saveDraft} onImport={importIndividual} onDelete={removeDraft} /></div>; })}</div></div></CardContent></Card>
        </>}
        <AlertDialog open={duplicateReviewOpen} onOpenChange={(open) => { if (!isSaving) setDuplicateReviewOpen(open); }}>
          <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Possíveis duplicidades encontradas</AlertDialogTitle>
              <AlertDialogDescription>Os itens abaixo têm o mesmo valor na mesma data de lançamentos já existentes no Financeiro. Desmarque os itens que deseja remover da importação.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-4">
              {possibleDuplicateDrafts.map((draft) => <label key={draft.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3"><Checkbox checked={!excludedDuplicateIds.has(draft.id)} onCheckedChange={(checked) => setExcludedDuplicateIds((current) => { const next = new Set(current); if (checked) next.delete(draft.id); else next.add(draft.id); return next; })} /><span className="space-y-1 text-sm"><span className="block font-medium">{draft.externalId} · {draft.date.split("-").reverse().join("/")} · R$ {draft.value}</span><span className="block text-muted-foreground">{draft.description}</span><span className="block text-xs text-amber-600">Já existe um lançamento com este valor nesta data.</span></span></label>)}
            </div>
            <AlertDialogFooter><AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); continueAfterDuplicateReview(); }}>Continuar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={individualDuplicateOpen} onOpenChange={(open) => { if (!isSaving) setIndividualDuplicateOpen(open); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Possível duplicidade</AlertDialogTitle>
              <AlertDialogDescription>{individualDuplicateDraft ? `Já existe um lançamento com o valor de R$ ${individualDuplicateDraft.value} na data ${individualDuplicateDraft.date.split("-").reverse().join("/")}. Deseja importar mesmo assim?` : "Este lançamento pode ser duplicado."}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (individualDuplicateDraft) { setIndividualDuplicateOpen(false); void performIndividualImport(individualDuplicateDraft); } }}>Importar mesmo assim</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={confirmFinalizeOpen} onOpenChange={(open) => { if (!isSaving) setConfirmFinalizeOpen(open); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Concluir importação?</AlertDialogTitle>
              <AlertDialogDescription>{importableDrafts.length} lançamento(s) serão enviados para o Financeiro. {pdfDuplicateCount + excludedDuplicateIds.size} item(ns) serão ignorados por duplicidade. Essa ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            {isSaving && <div className="space-y-2 py-4"><div className="flex justify-between text-sm"><span>Importando lançamentos...</span><span>{importProgress.current} de {importProgress.total}</span></div><Progress value={importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0} /><p className="text-xs text-muted-foreground">Aguarde até a conclusão para fechar esta janela.</p></div>}
            <AlertDialogFooter><AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void handleFinalize(); }} disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : "Confirmar importação"}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default ImportarPdf;
