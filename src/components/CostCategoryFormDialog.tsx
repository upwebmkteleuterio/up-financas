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
import { CostCategory, CostType } from "@/types/finance";
import { useToast } from "@/components/ui/use-toast";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { parseISO } from "date-fns";

// Definindo o tipo de estado do formulário
interface FormState extends Omit<CostCategory, "id" | "isActive" | "value" | "dueDate"> {
  // dueDate agora armazena apenas o dia do mês (1-31)
  dueDay: number | undefined; 
}

const getInitialFormState = (initialData?: CostCategory): FormState => {
  let initialDueDay: number | undefined = undefined;
  
  if (initialData && initialData.dueDate) {
    // Se houver data, extrai o dia
    initialDueDay = parseISO(initialData.dueDate).getDate();
  } else if (initialData && initialData.type === "Fixo") {
    // Se for fixo mas sem data (novo), define o dia atual
    initialDueDay = new Date().getDate();
  }

  return {
    name: initialData?.name || "",
    type: initialData?.type || "Fixo",
    dueDay: initialDueDay,
    description: initialData?.description || "",
  };
};

interface CostCategoryFormDialogProps {
  trigger: React.ReactNode;
  initialData?: CostCategory;
  onSubmit: (category: Omit<CostCategory, "id" | "isActive">, id?: string) => void;
  onClose?: () => void;
}

const CostCategoryFormDialog: React.FC<CostCategoryFormDialogProps> = ({
  trigger,
  initialData,
  onSubmit,
  onClose,
}) => {
  const [formData, setFormData] = useState<FormState>(getInitialFormState(initialData));
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Inicializa o valor monetário (apenas para custos fixos)
  const initialValue = initialData && initialData.type === "Fixo" && initialData.value ? initialData.value : 0;
  const { 
    displayValue, 
    numericValue, 
    handleChange: handleCurrencyChange, 
    setNumericValue 
  } = useCurrencyInput(initialValue);

  // Resetar o formulário e o valor monetário quando o modal fechar
  useEffect(() => {
    if (!open) {
      const resetState = getInitialFormState(initialData);
      setFormData(resetState);
      setNumericValue(initialData && initialData.type === "Fixo" ? initialData.value || 0 : 0);
      if (onClose) {
        onClose();
      }
    } else {
      // Ao abrir, garantir que o estado inicial esteja correto
      setFormData(getInitialFormState(initialData));
      setNumericValue(initialData && initialData.type === "Fixo" ? initialData.value || 0 : 0);
    }
  }, [open, initialData, setNumericValue, onClose]);

  // Limpar campos de Fixo se mudar para Variável
  useEffect(() => {
    if (formData.type === "Variável") {
      setNumericValue(0);
      setFormData(prev => ({ ...prev, dueDay: undefined }));
    } else if (formData.type === "Fixo" && !formData.dueDay) {
      setFormData(prev => ({ ...prev, dueDay: new Date().getDate() }));
    }
  }, [formData.type, setNumericValue]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSelectChange = (id: keyof Omit<FormState, 'dueDay'>, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [id]: value as any,
    }));
  };
  
  const handleDueDayChange = (dayString: string) => {
    const day = parseInt(dayString, 10);
    setFormData((prev) => ({
      ...prev,
      dueDay: isNaN(day) ? undefined : day,
    }));
  };

  // Gera a lista de dias (1 a 31)
  const daysOfMonth = useMemo(() => {
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast({
        title: "Erro de Validação",
        description: "O nome da categoria é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    let categoryToSubmit: Omit<CostCategory, "id" | "isActive">;

    if (formData.type === "Fixo") {
      if (numericValue <= 0 || !formData.dueDay) {
        toast({
          title: "Erro de Validação",
          description: "Custos Fixos requerem Valor e Dia de Vencimento válidos.",
          variant: "destructive",
        });
        return;
      }
      
      // Cria uma data de vencimento para o mês atual com o dia selecionado
      const now = new Date();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), formData.dueDay);

      categoryToSubmit = {
        name: formData.name,
        type: "Fixo",
        value: numericValue,
        // Salvamos a data completa, mas o dia é o que importa para a recorrência
        dueDate: dueDate.toISOString().split("T")[0], 
        description: formData.description,
      };
    } else {
      // Tipo Variável
      categoryToSubmit = {
        name: formData.name,
        type: "Variável",
        description: formData.description,
        value: undefined,
        dueDate: undefined,
      };
    }

    onSubmit(categoryToSubmit, initialData?.id);
    setOpen(false);
  };

  const dialogTitle = initialData ? "Editar Categoria de Custo" : "Nova Categoria de Custo";
  const submitButtonText = initialData ? "Salvar Alterações" : "Cadastrar Categoria";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] bg-card text-card-foreground border-border max-h-[calc(100vh-10px)] overflow-y-auto my-[5px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            Configure uma nova categoria para organizar seus custos fixos e variáveis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Nome da Categoria */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Categoria *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Aluguel, Salário, Marketing"
              required
              className="border border-border bg-input"
            />
          </div>

          {/* Tipo (Fixo/Variável) */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: CostType) =>
                handleSelectChange("type", value)
              }
            >
              <SelectTrigger id="type" className="border border-border bg-input">
                <SelectValue placeholder="Selecione o Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fixo">Fixo (Valor e Dia de Vencimento definidos)</SelectItem>
                <SelectItem value="Variável">Variável (Valor definido na transação)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campos Condicionais (Apenas para Fixo) */}
          {formData.type === "Fixo" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Valor Fixo (R$) *</Label>
                <Input
                  id="value"
                  type="text"
                  value={`R$ ${displayValue}`}
                  onChange={handleCurrencyChange}
                  placeholder="R$ 0,00"
                  required
                  className="border border-border bg-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDay">Dia de Vencimento *</Label>
                <Select
                  value={formData.dueDay?.toString() || ""}
                  onValueChange={handleDueDayChange}
                >
                  <SelectTrigger id="dueDay" className="border border-border bg-input">
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfMonth.map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        Dia {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Detalhes adicionais sobre o custo"
              className="border border-border bg-input"
            />
          </div>

          <Button type="submit" className="mt-4">
            {submitButtonText}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CostCategoryFormDialog;