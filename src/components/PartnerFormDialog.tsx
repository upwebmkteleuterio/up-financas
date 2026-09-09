import React, { useState, useEffect } from "react";
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
import { Partner } from "@/types/finance";
import { useToast } from "@/components/ui/use-toast";

// Função de máscara de telefone (reutilizada de SaleFormDialog)
const maskPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  } else {
    return cleaned
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  }
};

interface FormState extends Omit<Partner, "id" | "isActive"> {}

const getInitialFormState = (initialData?: Partner): FormState => {
    return {
        name: initialData?.name || "",
        phone: initialData?.phone || "",
    };
};

interface PartnerFormDialogProps {
    trigger: React.ReactNode;
    initialData?: Partner;
    onSubmit: (partner: Omit<Partner, "id" | "isActive">, id?: string) => void;
}

const PartnerFormDialog: React.FC<PartnerFormDialogProps> = ({ trigger, initialData, onSubmit }) => {
  const [formData, setFormData] = useState<FormState>(getInitialFormState(initialData));
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setFormData(getInitialFormState(initialData));
    }
  }, [open, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    
    if (id === "phone") {
        const maskedValue = maskPhone(value);
        setFormData((prev) => ({
            ...prev,
            [id]: maskedValue,
        }));
    } else {
        setFormData((prev) => ({
            ...prev,
            [id]: value,
        }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedPhone = formData.phone.replace(/\D/g, '');
    if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
        toast({
            title: "Erro de Validação",
            description: "O telefone deve ter 10 ou 11 dígitos (incluindo DDD).",
            variant: "destructive",
        });
        return;
    }

    if (!formData.name) {
      toast({
        title: "Erro de Validação",
        description: "O nome do sócio é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    
    const partnerToSubmit: Omit<Partner, "id" | "isActive"> = {
        name: formData.name,
        phone: formData.phone,
    };

    onSubmit(partnerToSubmit, initialData?.id);
    setOpen(false);
  };

  const dialogTitle = initialData ? "Editar Sócio" : "Cadastrar Novo Sócio";
  const submitButtonText = initialData ? "Salvar Alterações" : "Cadastrar Sócio";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            Informações básicas do sócio para gestão de saques.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nome completo do sócio"
              required
              className="border border-border bg-input"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(XX) XXXXX-XXXX"
              required
              className="border border-border bg-input"
            />
          </div>

          <Button type="submit" className="mt-4 bg-blue-600 hover:bg-blue-700">
            {submitButtonText}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PartnerFormDialog;