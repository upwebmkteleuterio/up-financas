import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import HiddenValue from "./HiddenValue";

interface SalesSummaryCardProps {
    month: string;
    volumeVendas: number;
    qtdVendas: number;
    formatCurrency: (value: number) => string;
}

const SalesSummaryCard: React.FC<SalesSummaryCardProps> = ({
    month,
    volumeVendas,
    qtdVendas,
    formatCurrency,
}) => {
    return (
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg relative overflow-hidden rounded-xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-sidebar-primary-foreground">
                    {month}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase font-semibold">Volume de Vendas</span>
                    <HiddenValue
                        value={volumeVendas}
                        formatFn={formatCurrency}
                        className="text-xl font-bold text-white"
                    />
                </div>
                <div className="flex flex-col pt-1 border-t border-sidebar-border/50">
                    <span className="text-xs text-gray-400 uppercase font-semibold">Quantidade</span>
                    <div className="flex items-baseline space-x-1">
                        <HiddenValue
                            value={qtdVendas}
                            isCurrency={false}
                            className="text-xl font-bold text-blue-400"
                        />
                        <span className="text-xs text-gray-500">vendas</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default SalesSummaryCard;