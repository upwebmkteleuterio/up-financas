import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketingInvestment, MarketingCategory, AssociatedSale, marketingCategories, Contract } from "@/types/finance";
import { useToast } from "@/components/ui/use-toast";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { DatePicker } from "./DatePicker";
import { parseISO, format, isValid } from "date-fns";
import { Plus, Minus, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import ContractFormDialog from "./ContractFormDialog"; // Importando o modal de contrato
import { useSales } from "@/hooks/useSales"; // Para adicionar o contrato
import { useMarketing } from "@/hooks/useMarketing"; // Para marcar a venda como lançada

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Helper function to format numeric value (in BRL) for display in input fields
const formatNumericValueToDisplay = (value: number): string => {
    const digits = Math.round(value * 100).toString();
    if (!digits) return "0,00";
    let cleanedDigits = digits.replace(/^0+/, "");
    if (cleanedDigits === "") cleanedDigits = "0";
    while (cleanedDigits.length < 3) {
        cleanedDigits = "0" + cleanedDigits;
    }
    const cents = cleanedDigits.slice(-2);
    let reals = cleanedDigits.slice(0, -2);
    if (reals === "") reals = "0";
    let formattedReals = "";
    for (let i = reals.length - 1, count = 0; i >= 0; i--, count++) {
        formattedReals = reals[i] + formattedReals;
        if (count % 3 === 2 && i !== 0) {
            formattedReals = "." + formattedReals;
        }
    }
    return `${formattedReals},${cents}`;
};

// Gerador de ID simples para vendas
const genSaleId = () => Date.now().toString() + Math.random().toString(36).substring(2, 9);

interface FormState extends Omit<MarketingInvestment, "id" | "date" | "investmentValue"> {
    date: Date;
    investmentValue: number;
    associatedSales: AssociatedSale[];
}

const getInitialFormState = (initialData?: MarketingInvestment): FormState => {
    return {
        name: initialData?.name || "",
        category: initialData?.category || marketingCategories[0],
        date: initialData?.date ? parseISO(initialData.date) : new Date(),
        investmentValue: initialData?.investmentValue || 0,
        leads: initialData?.leads,
        associatedSales: initialData?.associatedSales || [],
    };
};

interface MarketingInvestmentFormDialogProps {
    trigger: React.ReactNode;
    initialData?: MarketingInvestment;
    onSubmit: (investment: Omit<MarketingInvestment, "id">, id?: string) => void;
    onClose?: () => void;
}

const MarketingInvestmentFormDialog: React.FC<MarketingInvestmentFormDialogProps> = ({
    trigger,
    initialData,
    onSubmit,
    onClose,
}) => {
    const { addContract } = useSales();
    const { markSaleAsContractLaunched } = useMarketing();
    
    const [formData, setFormData] = useState<FormState>(getInitialFormState(initialData));
    const [open, setOpen] = useState(false);
    const { toast } = useToast();

    // Hook de moeda para o valor do investimento
    const { 
        displayValue: investmentDisplayValue, 
        numericValue: investmentNumericValue, 
        handleChange: handleInvestmentCurrencyChange, 
        setNumericValue: setInvestmentNumericValue 
    } = useCurrencyInput(formData.investmentValue);

    // Estado temporário para adicionar nova venda
    const [newSaleClientName, setNewSaleClientName] = useState("");
    const [newSaleValueDigits, setNewSaleValueDigits] = useState("");
    const [newSaleDateClosed, setNewSaleDateClosed] = useState<Date | undefined>(new Date());
    
    const newSaleDisplayValue = useMemo(() => formatNumericValueToDisplay(parseFloat(newSaleValueDigits) / 100 || 0), [newSaleValueDigits]);


    // Resetar o formulário e o valor monetário quando o modal fechar
    useEffect(() => {
        if (!open) {
            const resetState = getInitialFormState(initialData);
            setFormData(resetState);
            setInvestmentNumericValue(resetState.investmentValue);
            setNewSaleClientName("");
            setNewSaleValueDigits("");
            setNewSaleDateClosed(new Date());
            if (onClose) {
                onClose();
            }
        } else {
            // Ao abrir, garantir que o estado inicial esteja correto
            const initial = getInitialFormState(initialData);
            setFormData(initial);
            setInvestmentNumericValue(initial.investmentValue);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialData, onClose, setInvestmentNumericValue]);

    const handleBaseChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        const { id, value } = e.target;
        
        if (id === "leads") {
            const leads = parseInt(value, 10);
            setFormData((prev) => ({ ...prev, leads: isNaN(leads) ? undefined : leads }));
        } else {
            setFormData((prev) => ({ ...prev, [id]: value }));
        }
    };

    const handleSelectChange = (id: keyof FormState, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [id]: value as any,
        }));
    };

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData((prev) => ({
                ...prev,
                date: date,
            }));
        }
    };
    
    // --- Lógica de Vendas Associadas ---
    
    const handleNewSaleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const newDigits = rawValue.replace(/\D/g, "");
        if (newDigits.length > 15) return;
        setNewSaleValueDigits(newDigits);
    };

    const addAssociatedSale = () => {
        const clientName = newSaleClientName.trim();
        const saleValue = parseFloat(newSaleValueDigits) / 100;

        if (!clientName || saleValue <= 0 || !newSaleDateClosed) {
            toast({
                title: "Erro de Venda",
                description: "Preencha o nome do cliente, o valor da venda e a data de fechamento.",
                variant: "destructive",
            });
            return;
        }

        const newSale: AssociatedSale = {
            id: genSaleId(),
            clientName,
            saleValue,
            dateClosed: newSaleDateClosed.toISOString().split("T")[0], // Salva como string ISO
            contractId: undefined,
        };

        setFormData((prev) => ({
            ...prev,
            associatedSales: [...prev.associatedSales, newSale],
        }));

        // Resetar campos de nova venda
        setNewSaleClientName("");
        setNewSaleValueDigits("");
        setNewSaleDateClosed(new Date());
    };

    const removeAssociatedSale = (id: string) => {
        setFormData((prev) => ({
            ...prev,
            associatedSales: prev.associatedSales.filter((sale) => sale.id !== id),
        }));
    };
    
    // Callback chamado após o ContractFormDialog salvar um novo contrato
    const handleContractLaunched = (associatedSaleId: string, contractId: string) => {
        if (initialData?.id) {
            // 1. Atualiza o estado do hook useMarketing (persiste o contractId)
            markSaleAsContractLaunched(initialData.id, associatedSaleId, contractId);
            
            // 2. Atualiza o estado local do formulário para refletir a mudança imediatamente
            setFormData(prev => ({
                ...prev,
                associatedSales: prev.associatedSales.map(sale => 
                    sale.id === associatedSaleId ? { ...sale, contractId } : sale
                )
            }));
            
            toast({
                title: "Sucesso!",
                description: "Contrato lançado e vinculado à venda de marketing.",
            });
        }
    };
    
    // Função wrapper para o onSubmit do ContractFormDialog
    const handleContractSubmit = (
        contract: Omit<Contract, "id">, 
        associatedSaleId: string,
        closeContractModal: () => void
    ) => {
        // Adiciona o contrato e obtém o ID gerado (o hook useSales lida com isso)
        const newContract = addContract(contract);
        
        // Chama o callback para vincular a venda associada ao novo contrato
        handleContractLaunched(associatedSaleId, newContract.id);
        
        closeContractModal();
    };


    // --- Submissão do Modal de Marketing ---

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.category || investmentNumericValue <= 0 || !formData.date) {
            toast({
                title: "Erro de Validação",
                description: "Preencha Nome, Categoria, Investimento e Data.",
                variant: "destructive",
            });
            return;
        }

        const investmentToSubmit: Omit<MarketingInvestment, "id"> = {
            name: formData.name,
            category: formData.category,
            date: formData.date.toISOString().split("T")[0],
            investmentValue: investmentNumericValue,
            leads: formData.leads,
            associatedSales: formData.associatedSales,
        };

        onSubmit(investmentToSubmit, initialData?.id);
        setOpen(false);
    };

    const dialogTitle = initialData ? "Editar Investimento de Marketing" : "Novo Investimento de Marketing";
    const submitButtonText = initialData ? "Salvar Alterações" : "Cadastrar Investimento";

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            {/* Reduzindo o tamanho máximo do modal para sm:max-w-[425px] */}
            <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border max-h-[calc(100vh-10px)] overflow-y-auto my-[5px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {dialogTitle}
                    </DialogTitle>
                    <DialogDescription>
                        Registre o investimento e acompanhe as vendas associadas.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    
                    {/* Nome e Categoria */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome do Investimento *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={handleBaseChange}
                                placeholder="Ex: Campanha de Outono"
                                required
                                className="border border-border bg-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Categoria *</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value: MarketingCategory) =>
                                    handleSelectChange("category", value)
                                }
                            >
                                <SelectTrigger id="category" className="border border-border bg-input">
                                    <SelectValue placeholder="Selecione a Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {marketingCategories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Investimento e Data */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="investmentValue">Investimento (R$) *</Label>
                            <Input
                                id="investmentValue"
                                type="text"
                                value={`R$ ${investmentDisplayValue}`}
                                onChange={handleInvestmentCurrencyChange}
                                placeholder="R$ 0,00"
                                required
                                className="border border-border bg-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date">Data *</Label>
                            <DatePicker 
                                date={formData.date} 
                                setDate={handleDateChange} 
                                placeholder="Selecione a data"
                            />
                        </div>
                    </div>
                    
                    {/* Leads (Opcional) */}
                    <div className="space-y-2">
                        <Label htmlFor="leads">Leads Gerados (opcional)</Label>
                        <Input
                            id="leads"
                            type="number"
                            min="0"
                            value={formData.leads || ""}
                            onChange={handleBaseChange}
                            placeholder="0"
                            className="border border-border bg-input"
                        />
                    </div>

                    {/* Vendas Associadas */}
                    <div className="space-y-4 pt-2">
                        <Label className="font-semibold">Vendas Associadas ({formData.associatedSales.length})</Label>
                        
                        {/* Lista de Vendas */}
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {formData.associatedSales.map((sale) => {
                                const isContractLaunched = !!sale.contractId;
                                
                                // Prepara a data para o ContractFormDialog
                                const dateClosedObject = sale.dateClosed ? parseISO(sale.dateClosed) : undefined;
                                const isDateValid = dateClosedObject && isValid(dateClosedObject);

                                return (
                                    <div key={sale.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                                        <div className="flex flex-col flex-1 min-w-0 mr-2">
                                            <span className="text-sm font-medium truncate">
                                                {sale.clientName}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {sale.dateClosed ? format(parseISO(sale.dateClosed), 'dd/MM/yyyy') : 'N/A'} - {formatCurrency(sale.saleValue)}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                            {isContractLaunched ? (
                                                <span className="text-xs font-semibold text-green-500 whitespace-nowrap">
                                                    Contrato Lançado
                                                </span>
                                            ) : (
                                                <ContractFormDialog
                                                    open={true} // Add open prop
                                                    onOpenChange={() => {}} // Add onOpenChange prop
                                                    partialInitialData={{
                                                        clientName: sale.clientName,
                                                        dateClosed: isDateValid ? dateClosedObject : undefined
                                                    }}
                                                    // Passamos o ID da venda associada para que o callback saiba qual item atualizar
                                                    onSubmit={(contract) => handleContractSubmit(contract, sale.id, () => {})} 
                                                    trigger={
                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-7 text-blue-500 border-blue-500 hover:bg-blue-900/20 whitespace-nowrap"
                                                        >
                                                            <FileText className="w-3 h-3 mr-1" />
                                                            + Contrato
                                                        </Button>
                                                    }
                                                    // O onClose é usado para fechar o modal de contrato, mas aqui precisamos de um wrapper
                                                    onClose={() => {}} 
                                                />
                                            )}
                                            
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => removeAssociatedSale(sale.id)}
                                                className="h-6 w-6 text-red-500 hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Adicionar Nova Venda - Layout ajustado para mobile */}
                        <div className="flex flex-col space-y-2 border-t border-sidebar-border pt-4">
                            
                            {/* Linha 1: Nome e Valor */}
                            <div className="flex space-x-2">
                                {/* Cliente (Flexível) */}
                                <div className="space-y-1 flex-1">
                                    <Label htmlFor="newSaleClientName" className="text-xs">Cliente</Label>
                                    <Input
                                        id="newSaleClientName"
                                        value={newSaleClientName}
                                        onChange={(e) => setNewSaleClientName(e.target.value)}
                                        placeholder="Nome do cliente"
                                        className="border border-border bg-input h-9"
                                    />
                                </div>
                                {/* Valor (Flexível) */}
                                <div className="space-y-1 flex-1">
                                    <Label htmlFor="newSaleValue" className="text-xs">Valor (R$)</Label>
                                    <Input
                                        id="newSaleValue"
                                        type="text"
                                        value={`R$ ${newSaleDisplayValue}`}
                                        onChange={handleNewSaleValueChange}
                                        placeholder="R$ 0,00"
                                        className="border border-border bg-input h-9"
                                    />
                                </div>
                            </div>
                            
                            {/* Linha 2: Data Fechamento e Botão + */}
                            <div className="flex space-x-2 items-end">
                                {/* Data Fechamento (Flexível) */}
                                <div className="space-y-1 flex-1">
                                    <Label htmlFor="newSaleDateClosed" className="text-xs">Data Fechamento</Label>
                                    <DatePicker 
                                        date={newSaleDateClosed} 
                                        setDate={setNewSaleDateClosed} 
                                        placeholder="Data"
                                    />
                                </div>
                                {/* Botão + (Fixo) */}
                                <Button 
                                    type="button" 
                                    onClick={addAssociatedSale} 
                                    size="icon"
                                    className="h-9 w-9 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                                    disabled={!newSaleClientName.trim() || parseFloat(newSaleValueDigits) <= 0 || !newSaleDateClosed}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Button type="submit" className="mt-4 bg-blue-600 hover:bg-blue-700">
                        {submitButtonText}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default MarketingInvestmentFormDialog;