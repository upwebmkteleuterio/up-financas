import React from "react";
import { cn } from "@/lib/utils";
import { CostType } from "@/types/finance";

interface CostTagProps {
  type: CostType;
}

const CostTag: React.FC<CostTagProps> = ({ type }) => {
  const isFixo = type === "Fixo";
  
  const classes = cn(
    "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
    isFixo 
      ? "bg-blue-900/50 text-blue-400" 
      : "bg-yellow-900/50 text-yellow-400"
  );

  return (
    <span className={classes}>
      {type}
    </span>
  );
};

export default CostTag;