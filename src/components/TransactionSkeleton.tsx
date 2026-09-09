import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TransactionSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border">
      
      {/* Top/Left Section (Icon + Text) */}
      <div className="flex items-center space-x-4 flex-1 min-w-0 w-full md:w-auto">
        {/* Ícone Placeholder */}
        <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0 bg-secondary/50" />
        
        <div className="flex flex-col flex-1 min-w-0 space-y-1">
          {/* Linha Principal (Nome/Descrição) */}
          <Skeleton className="h-4 w-3/4 rounded bg-secondary/50" />
          {/* Linha Secundária (Categoria/Método) */}
          <Skeleton className="h-3 w-1/2 rounded bg-secondary/50" />
        </div>
      </div>
      
      {/* Bottom/Right Section (Value, Date, Actions) */}
      <div className="flex justify-between items-center w-full md:w-auto md:ml-4 mt-3 md:mt-0 flex-shrink-0">
        
        {/* Valor e Data */}
        <div className="flex flex-col items-start md:items-end">
          <Skeleton className="h-5 w-20 rounded bg-secondary/50" />
          <Skeleton className="h-3 w-16 rounded mt-1 bg-secondary/50" />
        </div>

        {/* Ações Placeholder */}
        <div className="flex space-x-1 ml-4">
          <Skeleton className="h-8 w-8 rounded-full bg-secondary/50" />
          <Skeleton className="h-8 w-8 rounded-full bg-secondary/50" />
        </div>
      </div>
    </div>
  );
};

export default TransactionSkeleton;