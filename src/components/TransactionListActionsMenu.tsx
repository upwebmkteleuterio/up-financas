import React from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { Transaction } from "@/types/finance";
import TransactionFormDialog from "./TransactionFormDialog";
import { showSuccess } from "@/utils/toast";

interface TransactionListActionsMenuProps {
  transaction: Transaction;
  onEdit: (updatedTransaction: Transaction) => void;
  onDelete: (id: string) => void;
}

const TransactionListActionsMenu: React.FC<TransactionListActionsMenuProps> = ({
  transaction,
  onEdit,
  onDelete,
}) => {
  
  const isAutomated = transaction.isAutomated || false;
  
  const handleEditSubmit = (data: Omit<Transaction, "id">, id?: string) => {
    if (id) {
      onEdit({ ...data, id });
      showSuccess("Transação atualizada com sucesso!");
    }
  };
  
  const handleDelete = () => {
    onDelete(transaction.id);
    showSuccess("Transação excluída com sucesso.");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-sidebar-foreground hover:bg-accent"
          title="Ações da Transação"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
        
        {/* Editar (Abre o modal de edição) */}
        <TransactionFormDialog
            initialData={transaction}
            onSubmit={handleEditSubmit}
            trigger={
                <DropdownMenuItem 
                    onSelect={(e) => e.preventDefault()} // Previne o fechamento do Dropdown ao abrir o Dialog
                    className="cursor-pointer flex items-center"
                    disabled={isAutomated}
                >
                    <Pencil className="w-4 h-4 mr-2" />
                    {isAutomated ? "Visualizar (Automática)" : "Editar"}
                </DropdownMenuItem>
            }
        />
        
        <DropdownMenuSeparator className="bg-border" />
        
        {/* Excluir (usando o Dialog de Confirmação) */}
        <DeleteConfirmationDialog
          title="Confirmar Exclusão"
          description={`Tem certeza que deseja excluir a transação "${transaction.description}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          trigger={
            <DropdownMenuItem 
              onSelect={(e) => e.preventDefault()} // Previne o fechamento do Dropdown ao abrir o Dialog
              className="cursor-pointer flex items-center text-red-500 hover:bg-red-900/20"
              disabled={isAutomated}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TransactionListActionsMenu;