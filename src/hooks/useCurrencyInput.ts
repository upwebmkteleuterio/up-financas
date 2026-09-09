import { useState, useCallback, useMemo } from "react";

/**
 * Formata uma string de dígitos (representando centavos) para o formato monetário brasileiro (R$ 0.000,00).
 * @param digits String contendo apenas dígitos (ex: '123456' para R$ 1.234,56)
 * @returns String formatada (ex: '1.234,56')
 */
const formatCurrency = (digits: string): string => {
  if (!digits) return "0,00";

  // 1. Remove zeros à esquerda, exceto se for o último dígito
  let cleanedDigits = digits.replace(/^0+/, "");
  if (cleanedDigits === "") cleanedDigits = "0";

  // 2. Garante pelo menos 3 dígitos (para centavos)
  while (cleanedDigits.length < 3) {
    cleanedDigits = "0" + cleanedDigits;
  }

  // 3. Separa centavos (os dois últimos dígitos)
  const cents = cleanedDigits.slice(-2);
  let reals = cleanedDigits.slice(0, -2);

  // Se a parte dos reais estiver vazia (ex: '05'), define como '0'
  if (reals === "") {
    reals = "0";
  }

  // 4. Adiciona separadores de milhares (pontos)
  let formattedReals = "";
  for (let i = reals.length - 1, count = 0; i >= 0; i--, count++) {
    formattedReals = reals[i] + formattedReals;
    if (count % 3 === 2 && i !== 0) {
      formattedReals = "." + formattedReals;
    }
  }

  return `${formattedReals},${cents}`;
};

interface CurrencyInputHook {
  displayValue: string;
  numericValue: number;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  setNumericValue: (value: number) => void;
}

export function useCurrencyInput(initialValue: number = 0): CurrencyInputHook {
  // Estado interno armazena o valor como string de centavos (ex: 12345)
  const initialDigits = Math.round(initialValue * 100).toString();
  const [digits, setDigits] = useState<string>(initialDigits);

  // Valor formatado para exibição no input
  const displayValue = useMemo(() => formatCurrency(digits), [digits]);

  // Valor numérico limpo para uso no backend/lógica de negócio
  const numericValue = useMemo(() => {
    return parseFloat(digits) / 100;
  }, [digits]);

  // Handler para o evento onChange do input
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    
    // Limpa a entrada, mantendo apenas dígitos
    const newDigits = rawValue.replace(/\D/g, "");

    // Limita o tamanho máximo para evitar overflow e mantém a usabilidade
    if (newDigits.length > 15) return;

    setDigits(newDigits);
  }, []);

  // Função para definir o valor numericamente (útil para resetar ou carregar dados)
  const setNumericValue = useCallback((value: number) => {
    const newDigits = Math.round(value * 100).toString();
    setDigits(newDigits);
  }, []);

  return {
    displayValue,
    numericValue,
    handleChange,
    setNumericValue,
  };
}