"use client";

import Layout from "@/components/Layout";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowDown, ArrowUp, Users, BarChart, ShoppingBag, PieChart, LineChart } from "lucide-react";
import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import FilterDropdown, { FilterPeriod } from "@/components/FilterDropdown";
import ReportChart from "@/components/ReportChart";
import { useReports } from "@/hooks/useReports";

// Definição das abas e seus ícones
const reportTabs = [
    { value: "Vendas", label: "Vendas", icon: <ShoppingBag className="w-4 h-4" />, color: "text-green-500" },
    { value: "Entradas", label: "Entradas", icon: <ArrowUp className="w-4 h-4" />, color: "text-yellow-500" },
    { value: "Saídas", label: "Saídas", icon: <ArrowDown className="w-4 h-4" />, color: "text-red-500" },
    { value: "SaqueLucro", label: "Saque de Lucro", icon: <Users className="w-4 h-4" />, color: "text-purple-500" },
];

const Relatorios = () => {
    const isMobile = useIsMobile();
    const { getReportData } = useReports();
    
    const [activeTab, setActiveTab] = useState<string>("Vendas");
    
    const [dateFilter, setDateFilter] = useState<FilterPeriod>(`month_${new Date().getMonth()}` as FilterPeriod);
    const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
        start: undefined,
        end: undefined,
    });
    
    const { 
        saídaData, 
        saqueData, 
        vendasData, 
        entradasData,
        serviceDistribution,
        recurrenceData,
        futureReceivables,
        saqueDistribution,
    } = useMemo(() => {
        return getReportData(dateFilter, customDateRange);
    }, [getReportData, dateFilter, customDateRange]);

    // --- Configuração das Séries ---
    
    // Vendas: Verde
    const vendasSeries = [{ 
        key: "Vendas", 
        name: "Vendas", 
        color: "#22c55e", 
        gradientId: "gradVendas", 
        type: 'area' as const 
    }];
    
    // Entradas: Amarelo/Dourado
    const entradasSeries = [{ 
        key: "Entradas", 
        name: "Entradas", 
        color: "#eab308", 
        gradientId: "gradEntradas", 
        type: 'area' as const 
    }];
    
    // Saídas: Azul e Vermelho
    const saídaSeries = [
        { key: "Custos", name: "Custos", color: "#3b82f6", gradientId: "gradCustos", stackId: "saidas", type: 'area' as const },
        { key: "Gastos", name: "Gastos", color: "#ef4444", gradientId: "gradGastos", stackId: "saidas", type: 'area' as const },
    ];
    
    // Saque de Lucro: Roxo
    const saqueLucroSeries = [{ 
        key: "Saque de Lucro", 
        name: "Saque de Lucro", 
        color: "#a855f7", 
        gradientId: "gradSaqueLucro", 
        type: 'area' as const 
    }];
    
    // Cores para gráficos de rosca
    const distributionColors = [
        { color: "#22c55e" }, { color: "#3b82f6" }, { color: "#a855f7" },
        { color: "#eab308" }, { color: "#ef4444" }, { color: "#f97316" },
    ];
    
    const recurrenceSeries = [
        { key: "Recorrente", name: "Recorrente", color: "#22c55e", stackId: "vendas", type: 'bar' as const },
        { key: "Pontual", name: "Pontual", color: "#3b82f6", stackId: "vendas", type: 'bar' as const },
    ];
    
    const futureReceivablesSeries = [{ key: "Valor a Receber", name: "Valor a Receber", color: "#eab308", type: 'line' as const }];
    
    const totalVendas = vendasData.reduce((sum, entry) => sum + (entry.Vendas || 0), 0);
    const totalSaques = saqueData.reduce((sum, entry) => sum + (entry["Saque de Lucro"] || 0), 0);
    
    const activeTabInfo = reportTabs.find(t => t.value === activeTab);

    return (
        <Layout 
            pageTitle="Relatórios" 
            pageSubtitle="Análise detalhada e histórica das finanças e vendas."
        >
            <div className="space-y-6">
                <div className="hidden lg:flex flex-col">
                    <h1 className="text-3xl font-bold text-sidebar-primary-foreground">Relatórios</h1>
                    <p className="text-gray-400 mt-1">Análise detalhada e histórica das finanças e vendas.</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center w-full md:w-auto">
                            <TabsList className="bg-sidebar-accent/50 flex-1 md:flex-none">
                                {reportTabs.map(tab => (
                                    <TabsTrigger 
                                        key={tab.value} 
                                        value={tab.value}
                                        className={cn("flex items-center", isMobile ? "px-3 py-2" : "px-4 py-2")}
                                    >
                                        {tab.icon}
                                        {!isMobile && <span className="ml-2">{tab.label}</span>}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {isMobile && activeTabInfo && (
                                <span className={cn("ml-4 text-lg font-semibold whitespace-nowrap", activeTabInfo.color)}>
                                    {activeTabInfo.label}
                                </span>
                            )}
                        </div>
                        <FilterDropdown
                            activeFilter={dateFilter}
                            setActiveFilter={setDateFilter}
                            customDateRange={customDateRange}
                            setCustomDateRange={setCustomDateRange}
                            allowedFilters={[
                                "month_0", "month_1", "month_2", "month_3", "month_4", "month_5",
                                "month_6", "month_7", "month_8", "month_9", "month_10", "month_11",
                                "custom"
                            ]}
                        />
                    </div>
                    
                    <Separator className="my-4 bg-sidebar-border" />

                    <TabsContent value="Vendas" className="mt-0 space-y-6">
                        <ReportChart
                            title="Vendas Diárias"
                            data={vendasData}
                            series={vendasSeries}
                            icon={<ShoppingBag className="w-5 h-5 text-green-500" />}
                            totalValue={totalVendas}
                            chartType="area"
                        />
                        <ReportChart
                            title="Distribuição por Serviço"
                            data={serviceDistribution}
                            series={distributionColors.map(c => ({ key: "value", name: "Serviço", color: c.color }))}
                            icon={<PieChart className="w-5 h-5 text-blue-500" />}
                            chartType="pie"
                            totalValue={totalVendas}
                        />
                        <ReportChart
                            title="Recorrência vs. Pontual"
                            data={recurrenceData}
                            series={recurrenceSeries}
                            icon={<BarChart className="w-5 h-5 text-yellow-500" />}
                            chartType="bar"
                            totalValue={totalVendas}
                        />
                        <ReportChart
                            title="Projeção de Recebimentos Futuros (Próximos 6 Meses)"
                            data={futureReceivables}
                            series={futureReceivablesSeries}
                            icon={<LineChart className="w-5 h-5 text-purple-500" />}
                            chartType="line"
                            dataKeyX="month"
                        />
                    </TabsContent>
                    
                    <TabsContent value="Entradas" className="mt-0">
                        <ReportChart
                            title="Entradas Financeiras"
                            data={entradasData}
                            series={entradasSeries}
                            icon={<ArrowUp className="w-5 h-5 text-yellow-500" />}
                            chartType="area"
                        />
                    </TabsContent>
                    
                    <TabsContent value="Saídas" className="mt-0 space-y-6">
                        <ReportChart
                            title="Saídas (Custos e Gastos)"
                            data={saídaData}
                            series={saídaSeries}
                            icon={<ArrowDown className="w-5 h-5 text-red-500" />}
                            chartType="area"
                        />
                    </TabsContent>
                    
                    <TabsContent value="SaqueLucro" className="mt-0 space-y-6">
                        <ReportChart
                            title="Saque de Lucro (Linha do Tempo)"
                            data={saqueData}
                            series={saqueLucroSeries}
                            icon={<Users className="w-5 h-5 text-purple-500" />}
                            chartType="area"
                            totalValue={totalSaques}
                        />
                        <ReportChart
                            title="Distribuição por Finalidade de Saque"
                            data={saqueDistribution}
                            series={distributionColors.map(c => ({ key: "value", name: "Finalidade", color: c.color }))}
                            icon={<PieChart className="w-5 h-5 text-purple-400" />}
                            chartType="pie"
                            totalValue={totalSaques}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default Relatorios;