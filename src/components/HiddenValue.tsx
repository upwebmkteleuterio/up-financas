import React from "react";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";

interface HiddenValueProps {
  value: number | string;
  formatFn?: (value: number) => string;
  className?: string;
  isCurrency?: boolean;
}

// Função auxiliar para gerar a string de asteriscos
const generateAsterisks = (formattedValue: string): string => {
    // Substitui cada dígito (0-9) por um asterisco (*), mantendo separadores (R$, ., ,)
    let result = formattedValue.replace(/[0-9]/g, '*');
    
    // Se for moeda, garante que o R$ e o espaço inicial sejam mantidos
    if (formattedValue.includes('R$')) {
        // Se houver muitos asteriscos (ex: R$ *.*.**,**), simplifica a parte inteira para '***'
        // Mas mantemos a substituição 1:1 para ser mais preciso.
        return result;
    }
    
    // Para números simples (como contagem), apenas retorna asteriscos
    return '***';
};

const HiddenValue: React.FC<HiddenValueProps> = ({ 
    value, 
    formatFn, 
    className, 
    isCurrency = true 
}) => {
  const { isVisible } = useFinancialVisibility();
  
  let formattedValue: string;
  
  if (typeof value === 'number') {
    formattedValue = formatFn ? formatFn(value) : value.toString();
  } else {
    formattedValue = value;
  }

  const displayValue = isVisible 
    ? formattedValue 
    : isCurrency 
        ? generateAsterisks(formattedValue) 
        : '***';

  return (
    <span className={className}>
      {displayValue}
    </span>
  );
};

export default HiddenValue;