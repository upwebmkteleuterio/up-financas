import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ResponsiveContainer,
    AreaChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Area
} from 'recharts';
import { cn } from "@/lib/utils";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface ReportChartCardProps {
    title: string;
    data: any[]; // Array de objetos com a chave 'date' e as chaves das séries
    series: { key: string; color: string; gradientId: string }[];
    icon: React.ReactNode;
}

const ReportChartCard: React.FC<ReportChartCardProps> = ({ title, data, series, icon }) => {
    const { isVisible } = useFinancialVisibility();
    
    // Formato customizado para o Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-2 bg-card border border-border rounded-md shadow-lg text-sm">
                    <p className="font-semibold text-sidebar-primary-foreground">{`Data: ${label}`}</p>
                    {payload.map((entry: any) => (
                        <p key={entry.name} style={{ color: entry.color }}>
                            {`${entry.name}: ${isVisible ? formatCurrency(entry.value) : '***'}`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Calcula o valor total para exibir no título
    const totalValue = data.reduce((sum, entry) => {
        let dailySum = 0;
        series.forEach(s => {
            dailySum += entry[s.key] || 0;
        });
        return sum + dailySum;
    }, 0);
    
    const formattedTotal = isVisible ? formatCurrency(totalValue) : '***';

    return (
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg h-[400px]">
            <CardHeader className="p-4">
                <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">
                        {icon}
                        <span className="ml-2">{title}</span>
                    </div>
                    <span className="text-lg font-extrabold text-gray-400">
                        {formattedTotal}
                    </span>
                </CardTitle>
                <p className="text-sm text-gray-400">Distribuição diária no período selecionado.</p>
            </CardHeader>
            <CardContent className="h-[300px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                    >
                        <defs>
                            {series.map(s => (
                                <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={s.color} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--sidebar-border))" />
                        <XAxis
                            dataKey="date"
                            stroke="hsl(var(--muted-foreground))"
                            tickFormatter={(tick, index) => index % 5 === 0 ? tick : ''}
                        />
                        <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            tickFormatter={(value) => isVisible ? formatCurrency(value) : '***'}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        
                        {series.map(s => (
                            <Area
                                key={s.key}
                                type="monotone"
                                dataKey={s.key}
                                stackId="1" // Empilha as áreas
                                stroke={s.color}
                                fill={`url(#${s.gradientId})`}
                                strokeWidth={2}
                                dot={{ r: 4, fill: s.color }}
                                activeDot={{ r: 6, stroke: s.color, strokeWidth: 2 }}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default ReportChartCard;