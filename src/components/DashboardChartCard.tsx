import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Importando componentes Shadcn/ui
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
import { Calendar } from "lucide-react";

interface DashboardChartCardProps {
    data: { date: string; "Valor Total Contratado": number }[];
    formatCurrency: (value: number) => string;
}

const DashboardChartCard: React.FC<DashboardChartCardProps> = ({ data, formatCurrency }) => {
    
    // Formato customizado para o Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-2 bg-card border border-border rounded-md shadow-lg text-sm">
                    <p className="font-semibold text-sidebar-primary-foreground">{`Data: ${label}`}</p>
                    <p className="text-green-500">{`${payload[0].name}: ${formatCurrency(payload[0].value)}`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg h-[400px]">
            <CardHeader className="p-4">
                <CardTitle className="text-xl font-bold flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-sidebar-primary" />
                    Contratos Fechados (Últimos 30 Dias)
                </CardTitle>
                <p className="text-sm text-gray-400">Valor total contratado por dia.</p>
            </CardHeader>
            <CardContent className="h-[300px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        // Aumentando a margem esquerda para 30 (já feito)
                        margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                    >
                        <defs>
                            <linearGradient id="colorContract" x1="0" y1="0" x2="0" y2="1">
                                {/* Cor primária (azul) no topo, com 80% de opacidade */}
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                {/* Transparente na base */}
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--sidebar-border))" />
                        <XAxis
                            dataKey="date"
                            stroke="hsl(var(--muted-foreground))"
                            tickFormatter={(tick, index) => index % 5 === 0 ? tick : ''} // Mostra a cada 5 dias
                        />
                        <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="Valor Total Contratado"
                            stroke="hsl(var(--primary))"
                            fill="url(#colorContract)" // Usa o gradiente como preenchimento
                            strokeWidth={2}
                            dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                            activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default DashboardChartCard;