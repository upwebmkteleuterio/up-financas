"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calculator, Delete, Check } from "lucide-react";

interface CalculatorDialogProps {
  trigger: React.ReactNode;
  onCopy: (value: number) => void;
}

const formatValue = (digits: string): string => {
  if (!digits || digits === "0") return "0,00";
  let cleaned = digits.replace(/^0+/, "");
  while (cleaned.length < 3) cleaned = "0" + cleaned;
  const cents = cleaned.slice(-2);
  const reals = cleaned.slice(0, -2);
  let formattedReals = "";
  for (let i = reals.length - 1, count = 0; i >= 0; i--, count++) {
    formattedReals = reals[i] + formattedReals;
    if (count % 3 === 2 && i !== 0) formattedReals = "." + formattedReals;
  }
  return `${formattedReals},${cents}`;
};

const CalculatorDialog: React.FC<CalculatorDialogProps> = ({ trigger, onCopy }) => {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNext, setWaitingForNext] = useState(false);

  const calculate = (first: number, second: number, op: string): number => {
    switch (op) {
      case "+": return first + second;
      case "-": return first - second;
      case "*": return first * second;
      case "/": return second !== 0 ? first / second : 0;
      default: return second;
    }
  };

  const handleNumber = useCallback((num: string) => {
    setDisplay((prev) => {
      if (waitingForNext) {
        setWaitingForNext(false);
        return num;
      }
      if (prev === "0") return num;
      return prev + num;
    });
  }, [waitingForNext]);

  const handleOperator = useCallback((nextOp: string) => {
    const currentValue = parseInt(display) / 100;
    if (previousValue === null) {
      setPreviousValue(currentValue);
    } else if (operator) {
      const result = calculate(previousValue, currentValue, operator);
      setPreviousValue(result);
      setDisplay(Math.round(result * 100).toString());
    }
    setOperator(nextOp);
    setWaitingForNext(true);
  }, [display, previousValue, operator]);

  const handleEqual = useCallback(() => {
    const currentValue = parseInt(display) / 100;
    if (previousValue !== null && operator) {
      const result = calculate(previousValue, currentValue, operator);
      setDisplay(Math.round(result * 100).toString());
      setPreviousValue(null);
      setOperator(null);
      setWaitingForNext(true);
    }
  }, [display, previousValue, operator]);

  const handleClear = useCallback(() => {
    setDisplay("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNext(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setDisplay((prev) => prev.length > 1 ? prev.slice(0, -1) : "0");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key >= "0" && e.key <= "9") handleNumber(e.key);
      if (["+", "-", "*", "/"].includes(e.key)) handleOperator(e.key);
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleEqual();
      }
      if (e.key === "Backspace") handleBackspace();
      if (e.key === "Escape") setOpen(false);
      if (e.key === "c" || e.key === "C") handleClear();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleNumber, handleOperator, handleEqual, handleBackspace, handleClear]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[320px] bg-card border-border p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Calculadora
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-input p-4 rounded-lg text-right">
            <div className="text-xs text-muted-foreground h-4 mb-1">
              {previousValue !== null ? `${formatValue(Math.round(previousValue * 100).toString())} ${operator}` : ""}
            </div>
            <div className="text-2xl font-bold font-mono">
              R$ {formatValue(display)}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button variant="outline" className="bg-red-900/20 text-red-500" onClick={handleClear}>C</Button>
            <Button variant="outline" onClick={handleBackspace}><Delete className="w-4 h-4" /></Button>
            <Button variant="outline" onClick={() => handleOperator("/")}>/</Button>
            <Button variant="outline" onClick={() => handleOperator("*")}>*</Button>
            
            {[7, 8, 9].map(n => <Button key={n} variant="secondary" onClick={() => handleNumber(n.toString())}>{n}</Button>)}
            <Button variant="outline" onClick={() => handleOperator("-")}>-</Button>
            
            {[4, 5, 6].map(n => <Button key={n} variant="secondary" onClick={() => handleNumber(n.toString())}>{n}</Button>)}
            <Button variant="outline" onClick={() => handleOperator("+")}>+</Button>
            
            {[1, 2, 3].map(n => <Button key={n} variant="secondary" onClick={() => handleNumber(n.toString())}>{n}</Button>)}
            <Button className="bg-blue-600 hover:bg-blue-700 row-span-2" onClick={handleEqual}>=</Button>
            
            <Button variant="secondary" className="col-span-2" onClick={() => handleNumber("0")}>0</Button>
            <Button variant="secondary" onClick={() => handleNumber("00")}>00</Button>
          </div>
          <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={() => {
            onCopy(parseInt(display) / 100);
            setOpen(false);
          }}>
            <Check className="w-4 h-4" /> Copiar para Valor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalculatorDialog;