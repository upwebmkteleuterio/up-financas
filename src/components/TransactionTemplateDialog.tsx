import React, { useState, useMemo } from "react";
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
import { Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { useTransactionTemplates, TransactionTemplate, TemplateToSave } from "@/hooks/useTransactionTemplates";
import { usePartners } from "@/hooks/usePartners";
import { showSuccess } from "@/utils/toast";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface TransactionTemplateDialogProps {
  trigger: React.ReactNode;
  onTemplateSelect: (template: TransactionTemplate) => void;
}

const TransactionTemplateDialog: React.FC<TransactionTemplateDialogProps> = ({ trigger, onTemplateSelect }) => {
  const { templates, isLoadingTemplates, updateTemplate, deleteTemplate } = useTransactionTemplates();
  const { partners } = usePartners();
  
  const [open, setOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TransactionTemplate | null>(null);

  const getPartnerNameById = (id?: string) => {
    if (!id) return null;
    return partners.find(p => p.id === id)?.name;
  };

  const handleUpdateTemplate = () => {
    if (editingTemplate) {
      const updatedTemplate: TransactionTemplate = {
        ...editingTemplate,
        cleanDescription: editingTemplate.cleanDescription.trim(),
      };
      
      if (!updatedTemplate.cleanDescription) {
          // Se a descrição estiver vazia, usa a categoria como fallback
          updatedTemplate.cleanDescription = updatedTemplate.category;
      }
      
      updateTemplate(updatedTemplate);
      showSuccess(`Template '${updatedTemplate.cleanDescription}' atualizado.`);
      setEditingTemplate(null);
    }
  };

  const handleDeleteTemplate = (templateToDelete: TransactionTemplate) => {
    deleteTemplate(templateToDelete.id);
    showSuccess(`Template excluído: ${templateToDelete.cleanDescription}.`);
  };
  
  const handleSelect = (template: TransactionTemplate) => {
      onTemplateSelect(template);
      setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[550px] bg-card border-border max-h-[calc(100vh-10px)] overflow-y-auto my-[5px]">
        <DialogHeader>
          <DialogTitle>Carregar Template de Saída</DialogTitle>
          <DialogDescription>
            Selecione um template salvo para preencher o formulário rapidamente.
          </DialogDescription>
        </DialogHeader>
        
        <Separator className="bg-border my-2" />

        {isLoadingTemplates ? (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        ) : (
            <div className="space-y-2">
                {templates.length === 0 ? (
                    <p className="text-center text-gray-500 p-4">
                        Nenhum template salvo. Use o botão "Salvar" no formulário de saída para criar um.
                    </p>
                ) : (
                    templates.map((template) => {
                        const isEditing = editingTemplate?.id === template.id;
                        
                        // Formatação da descrição para exibição
                        let displayDescription = template.cleanDescription;
                        let subGroup = "Gasto";
                        
                        if (template.category === "Saque de Lucro") {
                            subGroup = "Saque de Lucro";
                            const partnerName = getPartnerNameById(template.partnerId);
                            displayDescription = partnerName 
                                ? `${partnerName} ${template.cleanDescription ? `- ${template.cleanDescription}` : ''}`
                                : template.cleanDescription;
                        } else if (template.category) {
                            // Se for Custo, tentamos inferir o grupo (não é 100% preciso, mas funciona para exibição)
                            subGroup = "Custo"; 
                        }
                        
                        // Se a descrição limpa estiver vazia, usa a categoria
                        if (!displayDescription.trim()) {
                            displayDescription = template.category;
                        }

                        return (
                            <div key={template.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md hover:bg-secondary/80 transition-colors">
                                
                                {/* Detalhes do Template */}
                                <div className="flex flex-col flex-1 min-w-0 mr-4">
                                    {isEditing ? (
                                        <Input
                                            value={editingTemplate.cleanDescription}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, cleanDescription: e.target.value })}
                                            className="flex-1 mr-2 border border-border bg-input h-8"
                                        />
                                    ) : (
                                        <>
                                            <span className="font-medium text-sidebar-primary-foreground truncate">
                                                {displayDescription}
                                            </span>
                                            <span className="text-xs text-gray-400 mt-0.5">
                                                {subGroup} • Categoria: {template.category}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Ações */}
                                <div className="flex space-x-1 flex-shrink-0">
                                    {isEditing ? (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={handleUpdateTemplate}
                                            title="Salvar Edição"
                                        >
                                            <Save className="w-4 h-4 text-green-500" />
                                        </Button>
                                    ) : (
                                        <>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleSelect(template)}
                                                className="h-8 text-blue-500 hover:bg-blue-900/20"
                                            >
                                                Carregar
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => setEditingTemplate(template)}
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <DeleteConfirmationDialog
                                                title={`Excluir Template`}
                                                description={`Tem certeza que deseja excluir o template "${template.cleanDescription}"?`}
                                                onConfirm={() => handleDeleteTemplate(template)}
                                                trigger={
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="text-red-500 hover:bg-red-900/20"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                }
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TransactionTemplateDialog;