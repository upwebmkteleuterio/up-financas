import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import ExpenseCategoryManagementContent from "./ExpenseCategoryManagementContent";

interface ExpenseCategoryManagerDialogProps {
  trigger: React.ReactNode;
}

const ExpenseCategoryManagerDialog: React.FC<ExpenseCategoryManagerDialogProps> = ({ trigger }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[450px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias de Gastos</DialogTitle>
          <DialogDescription>
            Adicione, edite ou remova categorias de gastos da empresa.
          </DialogDescription>
        </DialogHeader>
        <ExpenseCategoryManagementContent />
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseCategoryManagerDialog;