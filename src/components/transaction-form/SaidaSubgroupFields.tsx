"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import ExpenseCategoryManagerDialog from "../ExpenseCategoryManagerDialog";
import { SaidaGroup } from "@/hooks/useTransactionForm";

interface SaidaSubgroupFieldsProps {
    activeGroup: SaidaGroup | undefined;
    onGroupChange: (group: SaidaGroup) => void;
    category: string;
    onCategoryChange: (cat: string) => void;
    partnerId: string | undefined;
    onPartnerChange: (id: string) => void;
    saídaCategories: { Custos: string[], Gastos: string[], SaqueLucro: string[], FundoCaixa: string[] };
    activePartners: any[];
    disabled?: boolean;
}

const SaidaSubgroupFields: React.FC<SaidaSubgroupFieldsProps> = ({
    activeGroup,
    onGroupChange,
    category,
    onCategoryChange,
    partnerId,
    onPartnerChange,
    saídaCategories,
    activePartners,
    disabled
}) => {
    // Regra: Não mostrar seleção de categoria se for Saque ou Fundo (redundante)
    const showCategorySelect = activeGroup === "Custo" || activeGroup === "Gasto";

    return (
        <>
            <div className="space-y-2">
                <Label>Subgrupo de Saída *</Label>
                <ToggleGroup 
                    type="single" 
                    value={activeGroup} 
                    onValueChange={(v) => v && onGroupChange(v as SaidaGroup)} 
                    className="w-full justify-between bg-secondary/50 rounded-lg p-1" 
                    disabled={disabled}
                >
                    <ToggleGroupItem value="Custo" className="flex-1 data-[state=on]:bg-sidebar-primary data-[state=on]:text-sidebar-primary-foreground">Custo</ToggleGroupItem>
                    <ToggleGroupItem value="Gasto" className="flex-1 data-[state=on]:bg-sidebar-primary data-[state=on]:text-sidebar-primary-foreground">Gasto</ToggleGroupItem>
                    <ToggleGroupItem value="SaqueLucro" className="flex-1 data-[state=on]:bg-sidebar-primary data-[state=on]:text-sidebar-primary-foreground">Saque</ToggleGroupItem>
                    <ToggleGroupItem value="FundoCaixa" className="flex-1 data-[state=on]:bg-sidebar-primary data-[state=on]:text-sidebar-primary-foreground">Fundo</ToggleGroupItem>
                </ToggleGroup>
            </div>

            {activeGroup && showCategorySelect && (
                <div className="space-y-2">
                    <Label>Categoria Específica *</Label>
                    <div className="flex space-x-2">
                        <Select value={category} onValueChange={onCategoryChange} disabled={disabled}>
                            <SelectTrigger className="flex-1 bg-input">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {activeGroup === "Custo" && saídaCategories.Custos.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                {activeGroup === "Gasto" && saídaCategories.Gastos.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {activeGroup === "Gasto" && !disabled && (
                            <ExpenseCategoryManagerDialog trigger={<Button variant="outline" size="icon" type="button"><Settings className="w-4 h-4" /></Button>} />
                        )}
                    </div>
                </div>
            )}
            
            {activeGroup === "SaqueLucro" && (
                <div className="space-y-2">
                    <Label>Sócio *</Label>
                    <Select value={partnerId || ""} onValueChange={onPartnerChange} disabled={disabled}>
                        <SelectTrigger className="bg-input">
                            <SelectValue placeholder={activePartners.length > 0 ? "Selecione o Sócio" : "Nenhum sócio ativo"} />
                        </SelectTrigger>
                        <SelectContent>
                            {activePartners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </>
    );
};

export default SaidaSubgroupFields;