import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { ServiceCategory } from "@/types/finance";
import { showSuccess } from "@/utils/toast";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ServiceCategoryItemProps {
    category: ServiceCategory;
    editingCategory: ServiceCategory | null;
    setEditingCategory: (category: ServiceCategory | null) => void;
    handleUpdateCategory: () => void;
    handleDeleteCategory: (category: ServiceCategory) => void;
}

const ServiceCategoryItem: React.FC<ServiceCategoryItemProps> = ({
    category,
    editingCategory,
    setEditingCategory,
    handleUpdateCategory,
    handleDeleteCategory,
}) => {
    const isEditing = editingCategory?.id === category.id;

    return (
        <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
            
            {isEditing ? (
                <Input
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="flex-1 mr-2 border border-border bg-input"
                    autoFocus
                />
            ) : (
                <span className="font-medium flex-1 text-foreground">
                    {category.name}
                </span>
            )}

            <div className="flex space-x-1">
                {isEditing ? (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleUpdateCategory}
                        title="Salvar"
                    >
                        <Save className="w-4 h-4 text-green-500" />
                    </Button>
                ) : (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setEditingCategory(category)}
                        title="Editar"
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                )}

                <DeleteConfirmationDialog
                    title={`Excluir Solução: ${category.name}`}
                    description={`Tem certeza que deseja excluir esta solução? Isso removerá a opção de novos cadastros, mas não alterará contratos já registrados.`}
                    onConfirm={() => handleDeleteCategory(category)}
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
            </div>
        </div>
    );
};

const ServiceCategoryManagementContent: React.FC = () => {
  const { serviceCategories, addServiceCategory, updateServiceCategory, deleteServiceCategory, isLoadingServices } = useServices();
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (name && !serviceCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      addServiceCategory(name);
      setNewCategoryName("");
      showSuccess(`Solução '${name}' adicionada.`);
    }
  };

  const handleUpdateCategory = () => {
    if (editingCategory) {
      const name = editingCategory.name.trim();
      if (name && !serviceCategories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCategory.id)) {
        updateServiceCategory(editingCategory);
        showSuccess(`Solução '${name}' atualizada.`);
        setEditingCategory(null);
      }
    }
  };

  const handleDeleteCategory = (categoryToDelete: ServiceCategory) => {
    deleteServiceCategory(categoryToDelete.id);
    showSuccess(`Solução '${categoryToDelete.name}' excluída.`);
  };

  return (
    <div className="space-y-4">
        <form onSubmit={handleAddCategory} className="flex space-x-2">
          <Input
            placeholder="Nome da nova solução/serviço"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border border-border bg-input"
          />
          <Button type="submit" size="icon" disabled={!newCategoryName.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </form>

        <Separator className="bg-border my-2" />

        <div className="max-h-96 overflow-y-auto space-y-2">
          {isLoadingServices ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : serviceCategories.length > 0 ? (
            serviceCategories.map((category) => (
              <ServiceCategoryItem
                  key={category.id}
                  category={category}
                  editingCategory={editingCategory}
                  setEditingCategory={setEditingCategory}
                  handleUpdateCategory={handleUpdateCategory}
                  handleDeleteCategory={handleDeleteCategory}
              />
            ))
          ) : (
            <p className="text-center text-gray-500 py-4 text-sm">Nenhuma solução cadastrada.</p>
          )}
        </div>
    </div>
  );
};

export default ServiceCategoryManagementContent;