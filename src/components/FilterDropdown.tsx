import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Filter, Calendar } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { DatePicker } from "./DatePicker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export type FilterPeriod =
  | "current_month"
  | "last_month"
  | "next_month"
  | "custom"
  | "current_week"
  | "next_week"
  | "last_week"
  | "month_0" | "month_1" | "month_2" | "month_3" | "month_4" | "month_5"
  | "month_6" | "month_7" | "month_8" | "month_9" | "month_10" | "month_11";

interface FilterDropdownProps {
  activeFilter: FilterPeriod;
  setActiveFilter: (filter: FilterPeriod) => void;
  customDateRange: { start: Date | undefined; end: Date | undefined };
  setCustomDateRange: (range: { start: Date | undefined; end: Date | undefined }) => void;
  allowedFilters?: FilterPeriod[]; // Novo prop para restringir opções
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  activeFilter,
  setActiveFilter,
  customDateRange,
  setCustomDateRange,
  allowedFilters = [
    "month_0", "month_1", "month_2", "month_3", "month_4", "month_5",
    "month_6", "month_7", "month_8", "month_9", "month_10", "month_11",
    "custom"
  ],
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const getLabel = (filter: FilterPeriod) => {
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    if (filter.startsWith("month_")) {
      const monthIndex = parseInt(filter.split("_")[1]);
      return monthNames[monthIndex];
    }

    switch (filter) {
      case "current_month":
        return "Mês Atual";
      case "last_month":
        return "Mês Passado";
      case "next_month":
        return "Mês Que Vem";
      case "current_week":
        return "Essa Semana";
      case "next_week":
        return "Semana Que Vem";
      case "last_week":
        return "Semana Passada";
      case "custom":
        return "Personalizar";
      default:
        return "Filtrar";
    }
  };
  
  const monthOptions = [
    { value: "month_0", label: "Janeiro" },
    { value: "month_1", label: "Fevereiro" },
    { value: "month_2", label: "Março" },
    { value: "month_3", label: "Abril" },
    { value: "month_4", label: "Maio" },
    { value: "month_5", label: "Junho" },
    { value: "month_6", label: "Julho" },
    { value: "month_7", label: "Agosto" },
    { value: "month_8", label: "Setembro" },
    { value: "month_9", label: "Outubro" },
    { value: "month_10", label: "Novembro" },
    { value: "month_11", label: "Dezembro" },
  ] as { value: FilterPeriod; label: string }[];

  const filterOptions: { value: FilterPeriod; label: string }[] = [
    ...monthOptions,
    { value: "current_month", label: "Mês Atual" },
    { value: "next_month", label: "Mês Que Vem" },
    { value: "current_week", label: "Essa Semana" },
    { value: "next_week", label: "Semana Que Vem" },
    { value: "last_week", label: "Semana Passada" },
    { value: "last_month", label: "Mês Passado" },
  ];

  const handleApplyCustomFilter = () => {
    if (customDateRange.start && customDateRange.end) {
      setActiveFilter("custom");
      setIsDialogOpen(false);
    }
  };

  return (
    <>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Filter className="w-4 h-4 mr-2" />
            {getLabel(activeFilter)}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72 bg-card border-l-border p-0">
          <SheetHeader className="p-6 border-b border-border">
            <SheetTitle>Filtrar por Período</SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-2 space-y-1">
              <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                Meses do Ano
              </div>
              
              {filterOptions
                .filter(option => option.value.startsWith("month_") && allowedFilters.includes(option.value))
                .map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setActiveFilter(option.value);
                      setIsSheetOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-md transition-colors text-sm",
                      activeFilter === option.value
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                        : "text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    {option.label}
                  </button>
                ))}

              {/* Opção Personalizar */}
              {allowedFilters.includes("custom") && (
                <div className="pt-2 mt-2 border-t border-border">
                  <button
                    onClick={() => {
                      setIsSheetOpen(false);
                      setTimeout(() => setIsDialogOpen(true), 300);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-md transition-colors text-sm flex justify-between items-center",
                      activeFilter === "custom"
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                        : "text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    Personalizar
                    <Calendar className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Dialog para Filtro Personalizado */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Período Personalizado</DialogTitle>
            <DialogDescription>
              Selecione o intervalo de datas para filtrar as transações.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <DatePicker 
                date={customDateRange.start} 
                setDate={(date) => setCustomDateRange({ ...customDateRange, start: date })} 
                placeholder="Início"
              />
              <Label htmlFor="end-date">Data Final</Label>
              <DatePicker 
                date={customDateRange.end} 
                setDate={(date) => setCustomDateRange({ ...customDateRange, end: date })} 
                placeholder="Fim"
              />
              <Button 
                onClick={handleApplyCustomFilter}
                className="mt-4"
                disabled={!customDateRange.start || !customDateRange.end}
              >
                Aplicar Filtro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FilterDropdown;