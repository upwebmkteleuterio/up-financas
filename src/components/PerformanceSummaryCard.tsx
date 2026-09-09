import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import HiddenValue from "./HiddenValue";

interface PerformanceSummaryCardProps {
    month: string;
    faturamento: number;
    lucro: number;
    formatCurrency: (value: number) => string;
}

const PerformanceSummaryCard: React.FC<PerformanceSummaryCardProps> = ({
    month,
    faturamento,
    lucro,
    formatCurrency,
}) => {
    const lucroColor = lucro >= 0 ? "text-green-400" : "text-red-400";

    return (
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg relative overflow-hidden rounded-xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-sidebar-primary-foreground">
                    {month}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase font-semibold">Faturamento</span>
                    <HiddenValue
                        value={faturamento}
                        formatFn={formatCurrency}
                        className="text-xl font-bold text-white"
                    />
                </div>
                <div className="flex flex-col pt-1 border-t border-sidebar-border/50">
                    <span className="text-xs text-gray-400 uppercase font-semibold">Lucro Real</span>
                    <HiddenValue
                        value={lucro}
                        formatFn={formatCurrency}
                        className={cn("text-xl font-bold", lucroColor)}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default PerformanceSummaryCard;