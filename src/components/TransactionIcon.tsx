import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/finance";

interface TransactionIconProps {
  type: TransactionType;
  customColor?: "purple" | "blue"; // Adicionando opção para roxo e azul
}

const TransactionIcon: React.FC<TransactionIconProps> = ({ type, customColor }) => {
  const isEntry = type === "Entrada";
  
  let bgColorClass = isEntry ? "bg-green-900/50" : "bg-red-900/50";
  let iconColorClass = isEntry ? "text-green-500" : "text-red-500";
  
  if (customColor === "purple") {
    bgColorClass = "bg-purple-900/50";
    iconColorClass = "text-purple-500";
  } else if (customColor === "blue") {
    bgColorClass = "bg-blue-900/50";
    iconColorClass = "text-blue-400";
  }

  const containerClasses = cn(
    "p-2 rounded-lg flex-shrink-0", // rounded-lg para borda arredondada
    bgColorClass
  );
  
  const iconClasses = cn(
    "w-5 h-5",
    iconColorClass
  );

  const IconComponent = isEntry ? TrendingUp : TrendingDown;

  return (
    <div className={containerClasses}>
      <IconComponent className={iconClasses} />
    </div>
  );
};

export default TransactionIcon;