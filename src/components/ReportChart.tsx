"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as Recharts from 'recharts';
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { cn, truncate } from "@/lib/utils";
import { useIsPhone } from "@/hooks/use-phone";

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Função para formato compacto (ex: R$ 0,75k) para mobile
const formatCurrencyCompact = (value: number) => {
  if (value === 0) return "R$ 0";
  const kValue = value / 1000;
  const formatted = kValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return `R$ ${formatted}k`;
};

type ChartType = 'area' | 'bar' | 'pie' | 'line';

interface ChartSeries {
    key: string;
    name: string;
    color: string;
    gradientId?: string;
    type?: 'bar' | 'area' | 'line';
    stackId?: string;
}

interface ReportChartProps {
    title: string;
    data: any[]; 
    series: ChartSeries[];
    icon: React.ReactNode;
    chartType?: ChartType;
    dataKeyX?: string; 
    totalValue?: number; 
}

const ReportChart: React.FC<ReportChartProps> = ({ 
    title, 
    data, 
    series, 
    icon, 
    chartType = 'area', 
    dataKeyX = 'date',
    totalValue,
}) => {
    const { isVisible } = useFinancialVisibility();
    const isPhone = useIsPhone();
    
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const dayData = payload[0].payload;
            
            // Calcula o total do dia somando os valores de todas as séries no payload
            const dayTotal = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

            return (
                <div className="p-3 bg-card border border-border rounded-md shadow-lg text-sm min-w-[200px]">
                    <div className="flex justify-between items-center mb-2 border-b border-border pb-1">
                        <p className="font-semibold text-sidebar-primary-foreground">
                            {`Data: ${label}`}
                        </p>
                    </div>
                    
                    {/* Exibe o Total do Dia em destaque */}
                    <div className="mb-3 p-2 bg-secondary/30 rounded flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-gray-400">Total do Dia:</span>
                        <span className="font-bold text-sidebar-primary-foreground">
                            {isVisible ? formatCurrency(dayTotal) : '***'}
                        </span>
                    </div>

                    <div className="space-y-4">
                        {payload.map((entry: any) => {
                            const detailsKey = `${entry.dataKey}_details`;
                            const details = dayData[detailsKey] as { label: string, value: number }[] | undefined;
                            return (
                                <div key={entry.name}>
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-bold text-[10px] uppercase text-gray-500" style={{ color: entry.color }}>
                                            {entry.name}
                                        </p>
                                        <span className="text-[10px] font-bold text-gray-400">
                                            {isVisible ? formatCurrency(entry.value) : '***'}
                                        </span>
                                    </div>
                                    {details && details.length > 0 ? (
                                        <div className="space-y-1 ml-1 border-l-2 border-border pl-2">
                                            {details.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center gap-4">
                                                    <span className="text-gray-400 text-[11px]">{truncate(item.label, 15)}</span>
                                                    <span className="font-medium text-[11px] whitespace-nowrap">{isVisible ? formatCurrency(item.value) : '***'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };
    
    const PieTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            return (
                <div className="p-2 bg-card border border-border rounded-md shadow-lg text-sm">
                    <p className="font-semibold text-sidebar-primary-foreground">{item.name}</p>
                    <p className="text-green-500">{`${isVisible ? formatCurrency(item.value) : '***'} (${item.percentage.toFixed(1)}%)`}</p>
                </div>
            );
        }
        return null;
    };

    const renderPieLegend = (value: string) => {
        const item = data.find(d => d.name === value);
        const displayValue = isVisible && item ? formatCurrency(item.value) : '***';
        return (
            <span className="text-xs text-gray-400">
                <span className="text-sidebar-primary-foreground font-medium">{value}</span>
                <span className="ml-2 font-bold text-gray-500">{displayValue}</span>
            </span>
        );
    };

    const formattedTotal = totalValue !== undefined ? (isVisible ? formatCurrency(totalValue) : '***') : '';
    const isPie = chartType === 'pie';

    const renderChart = () => {
        if (isPie) {
            return (
                <Recharts.ResponsiveContainer width="100%" height={isPhone ? 450 : 300}>
                    <Recharts.PieChart>
                        <Recharts.Tooltip content={<PieTooltip />} />
                        <Recharts.Legend 
                            layout={isPhone ? "horizontal" : "vertical"} 
                            verticalAlign={isPhone ? "bottom" : "middle"} 
                            align={isPhone ? "center" : "right"} 
                            formatter={renderPieLegend}
                            wrapperStyle={isPhone ? { 
                                paddingTop: '20px',
                                paddingBottom: '50px', 
                                position: 'relative',
                                width: '100%',
                                overflowY: 'auto'
                            } : { 
                                paddingLeft: '20px', 
                                overflowY: 'auto', 
                                height: '90%', 
                                width: '45%'
                            }}
                        />
                        <Recharts.Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx={isPhone ? "50%" : "40%"}
                            cy={isPhone ? 80 : "50%"}
                            innerRadius={isPhone ? 40 : 60}
                            outerRadius={isPhone ? 70 : 100}
                            fill="#8884d8"
                            paddingAngle={5}
                            label={false}
                            stroke="none" 
                        >
                            {data.map((entry, index) => (
                                <Recharts.Cell 
                                    key={`cell-${index}`} 
                                    fill={series[index % series.length]?.color || '#ccc'} 
                                />
                            ))}
                        </Recharts.Pie>
                    </Recharts.PieChart>
                </Recharts.ResponsiveContainer>
            );
        }
        
        const ChartComponent = chartType === 'bar' ? Recharts.BarChart : Recharts.AreaChart;
        
        return (
            <Recharts.ResponsiveContainer width="100%" height="100%">
                <ChartComponent data={data} margin={{ top: 5, right: 10, left: isPhone ? -10 : 30, bottom: 5 }}>
                    <defs>
                        {series.filter(s => s.gradientId).map(s => (
                            <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={s.color} stopOpacity={0.95}/>
                                <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <Recharts.CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--sidebar-border))" vertical={false} />
                    <Recharts.XAxis 
                        dataKey={dataKeyX} 
                        stroke="hsl(var(--muted-foreground))" 
                        tickFormatter={(tick, index) => {
                            // Se os dados forem uma lista de meses (ex: Jan-Dez = 12 itens), mostramos todos sem ocultar nenhum
                            if (data.length <= 12 || dataKeyX === 'month') {
                                return tick;
                            }
                            // Para dados diários longos (ex: relatórios de 30 dias), mantém a lógica de espaçamento automático
                            return index % (isPhone ? 10 : 5) === 0 ? tick : '';
                        }} 
                        axisLine={false} 
                        tickLine={false} 
                        fontSize={10} 
                    />
                    <Recharts.YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => isVisible ? (isPhone ? formatCurrencyCompact(value) : formatCurrency(value)) : '***'} axisLine={false} tickLine={false} fontSize={10} width={isPhone ? 50 : 80} />
                    <Recharts.Tooltip content={<CustomTooltip />} />
                    {!isPhone && <Recharts.Legend iconType="circle" />}
                    {series.map(s => (
                        chartType === 'bar' || s.type === 'bar' ? (
                            <Recharts.Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={s.stackId} radius={[4, 4, 0, 0]} />
                        ) : chartType === 'line' || s.type === 'line' ? (
                            <Recharts.Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: isPhone ? 2 : 4, fill: s.color }} />
                        ) : (
                            <Recharts.Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.gradientId ? `url(#${s.gradientId})` : s.color} fillOpacity={1} strokeWidth={2} stackId={s.stackId} />
                        )
                    ))}
                </ChartComponent>
            </Recharts.ResponsiveContainer>
        );
    };

    return (
        <Card className={cn("bg-sidebar border-sidebar-border text-sidebar-foreground shadow-lg transition-all", isPhone && isPie ? "min-h-[500px] h-auto" : "h-[400px]")}>
            <CardHeader className="p-4">
                <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">{icon}<span className="ml-2">{title}</span></div>
                    {totalValue !== undefined && <span className="text-lg font-extrabold text-gray-400">{formattedTotal}</span>}
                </CardTitle>
                <p className="text-sm text-gray-400">{chartType === 'pie' ? 'Distribuição percentual no período filtrado.' : 'Distribuição diária no período selecionado.'}</p>
            </CardHeader>
            <CardContent className={cn("p-4", isPhone && isPie ? "h-auto" : "h-[300px]")}>
                {data.length > 0 ? renderChart() : <div className="flex items-center justify-center h-full text-gray-500">Nenhum dado disponível para o período selecionado.</div>}
            </CardContent>
        </Card>
    );
};

export default ReportChart;