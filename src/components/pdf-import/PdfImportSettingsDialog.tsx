import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { subcategories } from "@/types/finance";

interface Props {
  userId?: string;
  activePartners: { id: string; name: string }[];
  onSaved: (settings: ImportSettings) => void;
}

export interface ImportSettings {
  defaultEntrySubgroup: string;
  defaultExitSubgroup: "Custo" | "Gasto" | "Saque" | "Fundo";
  defaultProfitPartnerId?: string;
}

const defaultSettings: ImportSettings = { defaultEntrySubgroup: "Outras Entradas", defaultExitSubgroup: "Gasto" };

const PdfImportSettingsDialog = ({ userId, activePartners, onSaved }: Props) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ImportSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    supabase.from("transaction_import_settings").select("default_entry_subgroup, default_exit_subgroup, default_profit_partner_id").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data) setSettings({ defaultEntrySubgroup: data.default_entry_subgroup || "Outras Entradas", defaultExitSubgroup: data.default_exit_subgroup, defaultProfitPartnerId: data.default_profit_partner_id || undefined });
    });
  }, [open, userId]);

  const save = async () => {
    if (!userId) return;
    setIsSaving(true);
    const { error } = await supabase.from("transaction_import_settings").upsert({ user_id: userId, default_entry_subgroup: settings.defaultEntrySubgroup, default_exit_subgroup: settings.defaultExitSubgroup, default_profit_partner_id: settings.defaultProfitPartnerId || null, updated_at: new Date().toISOString() });
    setIsSaving(false);
    if (error) return;
    onSaved(settings);
    setOpen(false);
  };

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><Settings className="mr-2 h-4 w-4" />Configurações</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Configurações da importação</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label>Subgrupo padrão para entradas</Label><Select value={settings.defaultEntrySubgroup} onValueChange={(value) => setSettings((current) => ({ ...current, defaultEntrySubgroup: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{subcategories.Entrada.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Subgrupo padrão para saídas</Label><Select value={settings.defaultExitSubgroup} onValueChange={(value) => setSettings((current) => ({ ...current, defaultExitSubgroup: value as ImportSettings["defaultExitSubgroup"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Custo">Custo</SelectItem><SelectItem value="Gasto">Gasto</SelectItem><SelectItem value="Saque">Saque</SelectItem><SelectItem value="Fundo">Fundo</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Sócio padrão para saque de lucros</Label><Select value={settings.defaultProfitPartnerId || "none"} onValueChange={(value) => setSettings((current) => ({ ...current, defaultProfitPartnerId: value === "none" ? undefined : value }))}><SelectTrigger><SelectValue placeholder="Nenhum sócio padrão" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{activePartners.map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button onClick={save} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar configurações"}</Button></DialogFooter></DialogContent></Dialog>;
};

export default PdfImportSettingsDialog;
