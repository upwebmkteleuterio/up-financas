import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useProfitDistribution } from "@/hooks/useProfitDistribution";
import { useFinance } from "@/hooks/use-finance";
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Calculator, 
  Settings, 
  RefreshCcw, 
  Wallet, 
  ArrowUp, 
  ArrowDown, 
  Users, 
  TrendingUp, 
  Pencil,
  FilePlus,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import HiddenValue from "@/components/HiddenValue";
import { showSuccess } from "@/utils/toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale"; // CORREÇÃO: Importação correta
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const PercentageBlurInput = ({ initialValue, onSave, label }: { initialValue: number, onSave: (val: number) => void, label: string }) => {
    const [localValue, setLocalValue] = useState(initialValue.toString());
    useEffect(() => { setLocalValue(initialValue.toString()); }, [initialValue]);
    return (
        <div className="space-y-1">
            <label className="text-[10px] uppercase text-gray-500 font-bold">{label}</label>
            <Input 
                type="number" 
                className="h-8 text-sm bg-input/50" 
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => onSave(Number(localValue))}
            />
        </div>
    );
};

const SummaryCard = ({ title, value, colorClass, icon, isCurrency = true, sublabel }: any) => (
  <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      <div className={cn("p-1 rounded-full", colorClass)}>{icon}</div>
    </CardHeader>
    <CardContent>
      <HiddenValue value={value} formatFn={isCurrency ? formatCurrency : (v: number) => Math.round(v).toString()} className="text-2xl font-bold text-sidebar-primary-foreground" isCurrency={isCurrency} />
      {sublabel && <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{sublabel}</p>}
    </CardContent>
  </Card>
);

const TotalInAccountStrip = ({ value }: { value: number }) => (
    <Card className="bg-card border-border shadow-xl rounded-[1rem]">
        <CardContent className="flex justify-between items-center p-5"> 
            <span className="text-gray-400 text-sm font-medium">Total Disponível em Conta (Real)</span>
            <HiddenValue value={value} formatFn={formatCurrency} className="text-2xl font-bold text-green-400" />
        </CardContent>
    </Card>
);

const GestaoDeProventos = () => {
  const {
    lançamentos,
    calculationList,
    settings,
    updateSettings,
    addToCalculation,
    addManualEntry,
    removeFromCalculation,
    updateItemPercentages,
    clearList,
    launchCurrentBalance,
    kpis
  } = useProfitDistribution();

  const { useFilteredTransactionsSummary } = useFinance();
  const { summary } = useFilteredTransactionsSummary("current_month", { start: undefined, end: undefined });

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState({ globalProfitPercentage: settings.globalProfitPercentage, globalFundPercentage: settings.globalFundPercentage });

  useEffect(() => {
    if (isSettingsOpen) setLocalSettings({ globalProfitPercentage: settings.globalProfitPercentage, globalFundPercentage: settings.globalFundPercentage });
  }, [isSettingsOpen, settings]);

  const [manualDescription, setManualDescription] = useState("");
  const { displayValue, numericValue, handleChange: handleManualValueChange, setNumericValue: setManualNumericValue } = useCurrencyInput(0);

  const handleLaunchBalance = () => {
    launchCurrentBalance(summary.totalEmConta);
    showSuccess("Saldo atual lançado na lista de cálculo.");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDescription || numericValue <= 0) return;
    addManualEntry(manualDescription, numericValue);
    setManualDescription(""); setManualNumericValue(0);
    setIsManualModalOpen(false);
    showSuccess("Lançamento manual adicionado.");
  };

  const handleSaveGlobalSettings = async () => {
    await updateSettings(localSettings);
    setIsSettingsOpen(false);
    showSuccess("Configurações globais salvas!");
  };

  return (
    <Layout pageTitle="Gestão de Proventos" pageSubtitle="Estratégia de divisão de lucros e caixa da empresa.">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="hidden lg:block">
                <h1 className="text-3xl font-bold text-sidebar-primary-foreground">Gestão de Proventos</h1>
                <p className="text-gray-400 mt-1">Simule e planeje sua distribuição financeira.</p>
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <VisibilityToggleButton />
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="icon" className="bg-sidebar-accent/50 border-sidebar-border" title="Configurações Globais"><Settings className="w-5 h-5" /></Button></DialogTrigger>
                    <DialogContent className="bg-card border-border">
                        <DialogHeader><DialogTitle>Configurações Globais</DialogTitle><DialogDescription>Valores padrão para novos itens.</DialogDescription></DialogHeader>
                        <div className="grid grid-cols-2 gap-4 py-4">
                            <div className="space-y-2"><Label>Lucro Padrão (%)</Label><Input type="number" value={localSettings.globalProfitPercentage} onChange={(e) => setLocalSettings({ ...localSettings, globalProfitPercentage: Number(e.target.value) })} /></div>
                            <div className="space-y-2"><Label>Caixa Padrão (%)</Label><Input type="number" value={localSettings.globalFundPercentage} onChange={(e) => setLocalSettings({ ...localSettings, globalFundPercentage: Number(e.target.value) })} /></div>
                        </div>
                        <DialogFooter><Button className="w-full gap-2" onClick={handleSaveGlobalSettings}><Save className="w-4 h-4" />Salvar Configurações</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
                    <DialogTrigger asChild><Button variant="outline" className="bg-sidebar-accent/50 border-sidebar-border gap-2"><FilePlus className="w-4 h-4" />Lançar Manual</Button></DialogTrigger>
                    <DialogContent className="bg-card border-border">
                        <DialogHeader>
                            <DialogTitle>Novo Lançamento Manual</DialogTitle>
                            <DialogDescription>Adicione um valor avulso para entrar no cálculo de distribuição.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleManualSubmit} className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Descrição</Label><Input placeholder="Ex: Reserva anterior, aporte..." value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} required /></div>
                            <div className="space-y-2"><Label>Valor (R$)</Label><Input value={`R$ ${displayValue}`} onChange={handleManualValueChange} required /></div>
                            <DialogFooter><Button type="submit" className="w-full">Adicionar ao Cálculo</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                <Button variant="outline" className="bg-sidebar-accent/50 border-sidebar-border gap-2" onClick={handleLaunchBalance}><Wallet className="w-4 h-4" />Lançar Saldo</Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Lucro Calculado" value={kpis.totalProfit} colorClass="bg-blue-900/50" icon={<TrendingUp className="w-4 h-4 text-blue-400" />} sublabel="Soma bruta das % de lucro" />
          <SummaryCard title="Livre para Saque" value={kpis.availableProfit} colorClass="bg-green-900/50" icon={<DollarSign className="w-4 h-4 text-green-500" />} sublabel={`Descontado ${formatCurrency(kpis.saquesDeLucro)} já sacados`} />
          <SummaryCard title="Fundo de Caixa Gerado" value={kpis.totalFund} colorClass="bg-purple-900/50" icon={<Users className="w-4 h-4 text-purple-400" />} sublabel="Soma bruta das % de reserva" />
          <SummaryCard title="Disponível Empresa" value={kpis.availableFund} colorClass="bg-orange-900/50" icon={<Calculator className="w-4 h-4 text-orange-400" />} sublabel={`Descontado ${formatCurrency(kpis.outrosGastos)} em gastos`} />
        </div>

        <TotalInAccountStrip value={summary.totalEmConta} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 bg-sidebar border-sidebar-border h-fit">
                <CardHeader className="p-4 border-b border-sidebar-border">
                    <CardTitle className="text-lg">Lançamentos do Mês</CardTitle>
                    <CardDescription>Recebidos e Pendentes de {format(new Date(), 'MMMM', { locale: ptBR })}.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                    {lançamentos.length > 0 ? (
                        lançamentos.map((r) => {
                            const isInCalc = calculationList.some(item => item.externalId === r.id);
                            return (
                                <div key={r.id} className={cn("flex items-center justify-between p-4 border-b border-sidebar-border", isInCalc && "opacity-40 grayscale")}>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold truncate">{r.clientName}</span>
                                            {r.isPaid ? (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 font-bold uppercase">Recebido</span>
                                            ) : (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 font-bold uppercase">Pendente</span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-500 uppercase">{r.service} • {format(parseISO(r.dueDate), "dd/MM")}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-green-500">{formatCurrency(r.value)}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" onClick={() => addToCalculation(r)} disabled={isInCalc}><Plus className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="p-8 text-center text-gray-500 text-sm">Nenhum lançamento este mês.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-sidebar border-sidebar-border border-2 border-dashed border-blue-500/20">
                <CardHeader className="p-4 border-b border-sidebar-border flex flex-row items-center justify-between">
                    <div><CardTitle className="text-lg">Área de Cálculo Estratégico</CardTitle><CardDescription>Ajuste as divisões individuais.</CardDescription></div>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-900/20 gap-2" onClick={clearList} disabled={calculationList.length === 0}><RefreshCcw className="w-4 h-4" />Limpar</Button>
                </CardHeader>
                <CardContent className="p-0">
                    {calculationList.length > 0 ? (
                        <div className="divide-y divide-sidebar-border">
                            {calculationList.map((item) => (
                                <div key={item.id} className="p-4 space-y-3 bg-card/20">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col"><span className="text-sm font-bold text-sidebar-primary-foreground">{item.description}</span><span className="text-xs text-gray-500">{formatCurrency(item.value)}</span></div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-900/20" onClick={() => removeFromCalculation(item.id)}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3">
                                            <PercentageBlurInput label="Lucro (%)" initialValue={item.profitPercentage} onSave={(val) => updateItemPercentages(item.id, val, item.fundPercentage)} />
                                            <div className="mt-5"><span className="text-xs font-bold text-green-500 whitespace-nowrap"><HiddenValue value={item.value * (item.profitPercentage / 100)} formatFn={formatCurrency} /></span></div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <PercentageBlurInput label="Fundo Caixa (%)" initialValue={item.fundPercentage} onSave={(val) => updateItemPercentages(item.id, item.profitPercentage, val)} />
                                            <div className="mt-5"><span className="text-xs font-bold text-purple-500 whitespace-nowrap"><HiddenValue value={item.value * (item.fundPercentage / 100)} formatFn={formatCurrency} /></span></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-20 flex flex-col items-center justify-center text-gray-500 space-y-3"><Calculator className="w-12 h-12 opacity-20" /><p className="text-sm">Sua área de cálculo está vazia.</p><p className="text-xs max-w-[250px] text-center opacity-70">Adicione recebimentos ou faça lançamentos manuais para começar a planejar sua distribuição.</p></div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </Layout>
  );
};

export default GestaoDeProventos;