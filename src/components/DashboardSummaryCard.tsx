import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DollarSign, Users, ArrowUp, ArrowDown } from "lucide-react";
import HiddenValue from "./HiddenValue"; // Importando HiddenValue
import SummaryChartBackground from "./SummaryChartBackground"; // Importando o novo componente

interface DashboardSummaryCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    colorClass: string;
    isCurrency?: boolean;
    formatCurrency: (value: number) => string;
    // NOVO: Dados para o gráfico de fundo
    chartData?: { name: string; value: number }[]; 
    gradientId: string; 
}

const DashboardSummaryCard: React.FC<DashboardSummaryCardProps> = ({
    title,
    value,
    icon,
    colorClass,
    isCurrency = true,
    formatCurrency,
    chartData, // Recebendo os dados
    gradientId,
}) => {
    const numericValue = typeof value === 'number' ? value : parseFloat(value);

    return (
        <Card className={cn(
            "bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg relative overflow-hidden", 
            "rounded-xl", // Arredondamento maior
            colorClass
        )}>
            {/* Fundo com Gráfico de Tendência */}
            {chartData && chartData.length > 0 && (
                <SummaryChartBackground 
                    data={chartData}
                    colorClass={colorClass}
                    gradientId={gradientId}
                />
            )}
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-gray-400">
                    {title}
                </CardTitle>
                <div className="p-1 rounded-full bg-white/10 text-white/80">
                    {icon}
                </div>
            </CardHeader>
            <CardContent className="relative z-10">
                <HiddenValue
                    value={numericValue}
                    formatFn={isCurrency ? formatCurrency : (v) => Math.round(v).toString()}
                    className="text-xl font-semibold mt-1 text-white" 
                    isCurrency={isCurrency}
                />
            </CardContent>
        </Card>
    );
};

export default DashboardSummaryCard;