import React from "react";
import { MoreVertical, XCircle, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import CancelContractDialog from "./CancelContractDialog";
import { Contract } from "@/types/finance";

interface ContractActionsMenuProps {
  contract: Contract;
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
  onDuplicate: (contract: Contract) => void;
  onCancel: (contract: Contract, installmentIdsToCancel: string[]) => void;
}

const ContractActionsMenu: React.FC<ContractActionsMenuProps> = ({
  contract,
  onEdit,
  onCancel,
}) => {
  
  const isCanceled = contract.isCanceled;
  
  // Se o contrato já estiver cancelado, não mostramos o menu de cancelamento/edição
  if (isCanceled) return null;
  
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
        
        {/* MELHORIA: Opção Editar Contrato */}
        <DropdownMenuItem 
          onSelect={() => onEdit(contract)}
          className="cursor-pointer flex items-center"
        >
          <Pencil className="w-4 h-4 mr-2" />
          Editar Contrato
        </DropdownMenuItem>

        {/* Cancelar Contrato */}
        <CancelContractDialog
            contract={contract}
            onConfirmCancel={(installmentIds) => onCancel(contract, installmentIds)}
            trigger={
                <DropdownMenuItem 
                    onSelect={(e) => e.preventDefault()} 
                    className="cursor-pointer flex items-center text-red-500 hover:bg-red-900/20"
                >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar Contrato
                </DropdownMenuItem>
            }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ContractActionsMenu;