import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { ExpenseCategory } from "@/types/finance";
import { showSuccess } from "@/utils/toast";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { Separator } from "@/components/ui/separator";
import { useFinance } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";

// Componente interno para renderizar um item da lista
interface ExpenseCategoryItemProps {
    category: ExpenseCategory;
    editingCategory: ExpenseCategory | null;
    setEditingCategory: (category: ExpenseCategory | null) => void;
    handleUpdateCategory: () => void;
    handleDeleteCategory: (category: ExpenseCategory) => void;
}

const ExpenseCategoryItem: React.FC<ExpenseCategoryItemProps> = ({
    category,
    editingCategory,
    setEditingCategory,
    handleUpdateCategory,
    handleDeleteCategory,
}) => {
    const isEditing = editingCategory?.id === category.id;
    const isProtected = category.name === "Outros Gastos";

    return (
        <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
            
            {isEditing ? (
                <Input
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="flex-1 mr-2 border border-border bg-input"
                />
            ) : (
                <span className={cn("font-medium flex-1", isProtected ? "text-gray-500" : "text-foreground")}>
                    {category.name}
                    {isProtected && <span className="text-xs text-gray-500 ml-2">(Padrão)</span>}
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
                        disabled={isProtected}
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                )}

                {/* O 'Outros Gastos' não pode ser excluído */}
                {!isProtected && (
                    <DeleteConfirmationDialog
                        title={`Excluir Categoria: ${category.name}`}
                        description={`Tem certeza que deseja excluir esta categoria? Todas as transações associadas serão reclassificadas para 'Outros Gastos'.`}
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
                )}
            </div>
        </div>
    );
};


const ExpenseCategoryManagementContent: React.FC = () => {
  const { expenseCategories, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory } = useExpenseCategories();
  const { updateTransactionCategoryOnDelete } = useFinance();
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (name && !expenseCategories.some(c => c.name === name)) {
      addExpenseCategory(name);
      setNewCategoryName("");
      showSuccess(`Categoria '${name}' adicionada.`);
    }
  };

  const handleUpdateCategory = () => {
    if (editingCategory) {
      const name = editingCategory.name.trim();
      if (name && !expenseCategories.some(c => c.name === name && c.id !== editingCategory.id)) {
        updateExpenseCategory(editingCategory);
        showSuccess(`Categoria '${name}' atualizada.`);
        setEditingCategory(null);
      }
    }
  };

  const handleDeleteCategory = (categoryToDelete: ExpenseCategory) => {
    // 1. Reclassificar transações antigas para 'Outros Gastos'
    updateTransactionCategoryOnDelete(categoryToDelete.name, "Outros Gastos");
    
    // 2. Excluir a categoria
    deleteExpenseCategory(categoryToDelete.id);
    showSuccess(`Categoria '${categoryToDelete.name}' excluída e transações reclassificadas.`);
  };

  return (
    <div className="space-y-4">
        
        {/* Adicionar Nova Categoria */}
        <form onSubmit={handleAddCategory} className="flex space-x-2">
          <Input
            placeholder="Nome da nova categoria de gasto"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border border-border bg-input"
          />
          <Button type="submit" size="icon" disabled={!newCategoryName.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </form>

        <Separator className="bg-border my-2" />

        {/* Lista de Categorias */}
        <div className="max-h-96 overflow-y-auto space-y-2">
          {expenseCategories.map((category) => (
            <ExpenseCategoryItem
                key={category.id}
                category={category}
                editingCategory={editingCategory}
                setEditingCategory={setEditingCategory}
                handleUpdateCategory={handleUpdateCategory}
                handleDeleteCategory={handleDeleteCategory}
            />
          ))}
        </div>
    </div>
  );
};

export default ExpenseCategoryManagementContent;