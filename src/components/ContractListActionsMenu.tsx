import React from "react";
import { MoreVertical, Pencil, Trash2, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { Contract } from "@/types/finance";

interface ContractListActionsMenuProps {
  contract: Contract;
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
  onDuplicate: (contract: Contract) => void;
}

const ContractListActionsMenu: React.FC<ContractListActionsMenuProps> = ({
  contract,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  
  const isCanceled = contract.isCanceled;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-sidebar-foreground hover:bg-accent"
          title="Ações do Contrato"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
        
        {/* Editar */}
        <DropdownMenuItem 
          onSelect={() => onEdit(contract)}
          className="cursor-pointer flex items-center"
          disabled={isCanceled}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Editar
        </DropdownMenuItem>
        
        {/* Duplicar */}
        <DropdownMenuItem 
          onSelect={() => onDuplicate(contract)}
          className="cursor-pointer flex items-center"
        >
          <Copy className="w-4 h-4 mr-2" />
          Duplicar
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-border" />
        
        {/* Excluir (usando o Dialog de Confirmação) */}
        <DeleteConfirmationDialog
          title="Confirmar Exclusão"
          description={`Tem certeza que deseja excluir o contrato de ${contract.clientName}? Esta ação não pode ser desfeita e removerá a entrada financeira automática associada.`}
          onConfirm={() => onDelete(contract.id)}
          trigger={
            <DropdownMenuItem 
              onSelect={(e) => e.preventDefault()} // Previne o fechamento do Dropdown ao abrir o Dialog
              className="cursor-pointer flex items-center text-red-500 hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir Permanentemente
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ContractListActionsMenu;