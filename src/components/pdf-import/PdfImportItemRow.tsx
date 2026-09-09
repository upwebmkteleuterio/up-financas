import { memo, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, FileText, Loader2, MoreHorizontal, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaymentMethod, subcategories, TransactionType } from "@/types/finance";
import DescriptionAutocomplete from "@/components/transaction-form/DescriptionAutocomplete";

export interface ImportDraft {
    id: string;
    batchId: string;
    externalId: string;
    date: string;
    type: TransactionType;
    subgroup: "Custo" | "Gasto" | "Saque" | "Fundo" | "Entrada";
    category: string;
    description: string;
    value: string;
    paymentMethod: PaymentMethod;
    notes: string;
    partnerId?: string;
    rawText: string;
    page?: number;
    duplicate: boolean;
    duplicateType?: "pdf_id" | "date_value";
    duplicateTransaction?: {
        description: string;
        category: string;
    };
    saved: boolean;
}

interface PdfImportItemRowProps {
    draft: ImportDraft;
    costNames: string[];
    expenseNames: string[];
    activePartners: {
        id: string;
        name: string;
    }[];
    userId?: string;
    saving: boolean;
    onSave: (draft: ImportDraft) => Promise<void>;
    onImport: (draft: ImportDraft) => Promise<void>;
    onDelete: (id: string) => void;
}

const paymentMethods: PaymentMethod[] = ["Pix", "Parcelado", "Dinheiro", "Cartão", "Transferência"];

const PdfImportItemRow = memo((
    {
        draft,
        costNames,
        expenseNames,
        activePartners,
        userId,
        saving,
        onSave,
        onImport,
        onDelete
    }: PdfImportItemRowProps
) => {
    const [localDraft, setLocalDraft] = useState(draft);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const [detailsDraft, setDetailsDraft] = useState({
        paymentMethod: draft.paymentMethod,
        notes: draft.notes
    });

    useEffect(() => {
        setLocalDraft(draft);

        setDetailsDraft({
            paymentMethod: draft.paymentMethod,
            notes: draft.notes
        });
    }, [draft]);

    const patch = (changes: Partial<ImportDraft>) => {
        setLocalDraft(current => ({
            ...current,
            ...changes,
            saved: false
        }));
    };

    const save = () => onSave(localDraft);
    const saveDescription = (description: string) => onSave({ ...localDraft, description, saved: false });
  
    const saveDetails = async () => {
        const next = {
            ...localDraft,
            ...detailsDraft,
            saved: false
        };

        setLocalDraft(next);
        await onSave(next);
        setDetailsOpen(false);
    };

    const changeType = (type: TransactionType) => {
        const changes = type === "Entrada" ? {
            type,
            subgroup: "Entrada" as const,
            category: subcategories.Entrada[0],
            partnerId: undefined
        } : {
            type,
            subgroup: (expenseNames.length ? "Gasto" : "Custo") as "Gasto" | "Custo",
            category: expenseNames.length ? expenseNames[0] : costNames[0] || "",
            partnerId: undefined
        };

        setLocalDraft(current => ({
            ...current,
            ...changes,
            saved: false
        }));

        void onSave({
            ...localDraft,
            ...changes,
            saved: false
        });
    };

    const changeSubgroup = (subgroup: ImportDraft["subgroup"]) => {
        const category = subgroup === "Custo" ? costNames[0] || "" : subgroup === "Gasto" ? expenseNames[0] || "" : subgroup === "Saque" ? "Saque de Lucro" : subgroup === "Fundo" ? "Fundo de Caixa" : subcategories.Entrada[0];

        const changes = {
            subgroup,
            category,
            description: subgroup === "Custo" || subgroup === "Gasto" ? category : localDraft.description,
            partnerId: subgroup === "Saque" ? activePartners[0]?.id : undefined
        };

        setLocalDraft(current => ({
            ...current,
            ...changes,
            saved: false
        }));

        void onSave({
            ...localDraft,
            ...changes,
            saved: false
        });
    };

    const changeAndSave = (changes: Partial<ImportDraft>) => {
        const next = {
            ...localDraft,
            ...changes,
            saved: false
        };

        setLocalDraft(next);
        void onSave(next);
    };

    const changeCategory = (category: string) => {
        const changes: Partial<ImportDraft> = { category };
        if (localDraft.subgroup === "Custo" || localDraft.subgroup === "Gasto") {
            changes.description = category;
        }
        changeAndSave(changes);
    };

    return (
        <Card className="border-border/70">
            <CardContent className="space-y-4 p-4">
                <div
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                    <div className="flex items-center gap-x-5 gap-y-2 text-sm overflow-x-auto">
                        <div className="shrink-0"><span className="text-xs text-muted-foreground">ID PDF</span><p className="font-medium whitespace-nowrap">{localDraft.externalId}</p></div>
                        <div><span className="text-xs text-muted-foreground">Tipo</span><p
                                className={localDraft.type === "Entrada" ? "font-medium text-green-500" : "font-medium text-red-500"}>{localDraft.type === "Entrada" ? <ArrowUp className="mr-1 inline h-4 w-4" /> : <ArrowDown className="mr-1 inline h-4 w-4" />}{localDraft.type}</p></div>
                        {localDraft.duplicateType === "pdf_id" ? <Badge variant="destructive">Já importado</Badge> : localDraft.duplicateType === "date_value" ? <Badge className="bg-amber-500 text-white hover:bg-amber-500">Possível duplicidade</Badge> : localDraft.saved ? <Badge variant="outline" className="text-green-600">Salvo</Badge> : <Badge variant="secondary">Não salvo</Badge>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">Página {localDraft.page || "-"}</span>
                </div>
                <div
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-[150px_190px_220px_minmax(220px,1fr)_120px_150px] xl:items-end">
                    <div className="space-y-2"><Label>Subgrupo</Label><Select value={localDraft.subgroup} onValueChange={changeSubgroup}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{localDraft.type === "Entrada" ? <SelectItem value="Entrada">Entrada</SelectItem> : <><SelectItem value="Custo">Custo</SelectItem><SelectItem value="Gasto">Gasto</SelectItem><SelectItem value="Saque">Saque</SelectItem><SelectItem value="Fundo">Fundo</SelectItem></>}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Categoria</Label><Select
                            value={localDraft.category}
                            onValueChange={changeCategory}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(localDraft.type === "Entrada" ? subcategories.Entrada : localDraft.subgroup === "Custo" ? costNames : localDraft.subgroup === "Gasto" ? expenseNames : localDraft.subgroup === "Saque" ? ["Saque de Lucro"] : ["Fundo de Caixa"]).map(
                                    category => <SelectItem key={category} value={category}>{category}</SelectItem>
                                )}</SelectContent></Select></div>
                    {localDraft.subgroup === "Saque" && <div className="space-y-2"><Label>Sócio</Label><Select
                            value={localDraft.partnerId || ""}
                            onValueChange={value => changeAndSave({
                                partnerId: value
                            })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{activePartners.map(
                                    partner => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                                )}</SelectContent></Select></div>}
                    <div className="space-y-2"><Label>Descrição</Label><DescriptionAutocomplete
                            userId={userId}
                            type={localDraft.type}
                            category={localDraft.category}
                            activePartners={activePartners}
                            value={localDraft.description}
                            onChange={value => patch({
                                description: value
                            })}
                            onBlur={value => saveDescription(value)}
                            onSuggestionSelect={saveDescription}
                            placeholder="Descrição" /></div>
                    <div className="space-y-2"><Label>Valor</Label><Input
                            value={localDraft.value}
                            onChange={event => patch({
                                value: event.target.value
                            })}
                            onBlur={save} /></div>
                    <div className="space-y-2"><Label>Data</Label><Input
                            type="date"
                            value={localDraft.date}
                            onChange={event => patch({
                                date: event.target.value
                            })}
                            onBlur={save} /></div>
                </div>
                <div
                    className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3">
                    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                        <DialogTrigger asChild><Button variant="outline" size="sm"><MoreHorizontal className="mr-1 h-4 w-4" />Mais detalhes</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Detalhes do lançamento</DialogTitle><DialogDescription>Informe os dados complementares antes de importar.</DialogDescription></DialogHeader>
                            <div className="space-y-4 py-4"><div className="space-y-2"><Label>Forma de pagamento</Label><Select
                                        value={detailsDraft.paymentMethod}
                                        onValueChange={value => setDetailsDraft(current => ({
                                            ...current,
                                            paymentMethod: value as PaymentMethod
                                        }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Observação</Label><Textarea
                                        value={detailsDraft.notes}
                                        onChange={event => setDetailsDraft(current => ({
                                            ...current,
                                            notes: event.target.value
                                        }))} /></div></div>
                            <DialogFooter><Button onClick={saveDetails} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar detalhes</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={save}
                        disabled={localDraft.saved || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : localDraft.saved ? "Salvo" : <><Save className="mr-1 h-4 w-4" />Salvar</>}</Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => onImport(localDraft)}
                        disabled={!localDraft.saved || saving || localDraft.duplicateType === "pdf_id"}><FileText className="mr-1 h-4 w-4" />Importar</Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500"
                        onClick={() => onDelete(localDraft.id)}
                        title="Excluir da importação"><Trash2 className="h-4 w-4" /></Button>
                </div>
            </CardContent>
        </Card>
    );
});

PdfImportItemRow.displayName = "PdfImportItemRow";
export default PdfImportItemRow;