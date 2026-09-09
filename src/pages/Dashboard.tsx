import Layout from "@/components/Layout";
import { useDashboard } from "@/hooks/useDashboard";
import DashboardSummaryCard from "@/components/DashboardSummaryCard";
import PerformanceSummaryCard from "@/components/PerformanceSummaryCard";
import SalesSummaryCard from "@/components/SalesSummaryCard"; 
import ReportChart from "@/components/ReportChart"; // Importando o gráfico padrão de Relatórios
import { Users, DollarSign, ArrowUp, ArrowDown, TrendingUp, ShoppingBag } from "lucide-react";
import React from "react";
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility";
import { Separator } from "@/components/ui/separator";

const Dashboard = () => {
    const { weeklySummary, monthlyPerformance, annualPerformance, formatCurrency } = useDashboard();

    // Configuração das séries para o gráfico de faturamento (Cor Verde: #22c55e)
    const faturamentoSeries = [
        { 
            key: "Faturamento", 
            name: "Faturamento", 
            color: "#22c55e", 
            gradientId: "gradFaturamento",
            type: "area" as const
        }
    ];

    // Configuração das séries para o gráfico de vendas (Cor Azul: #3b82f6)
    const vendasSeries = [
        { 
            key: "Vendas", 
            name: "Vendas", 
            color: "#3b82f6", 
            gradientId: "gradVendas",
            type: "area" as const
        }
    ];

    return (
        <Layout 
            pageTitle="Dashboard" 
            pageSubtitle="Visão geral e insights estratégicos do seu negócio."
        >
            <div className="space-y-8">
                {/* Header */}
                <div className="hidden lg:flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
                            Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Visão geral e insights estratégicos do seu negócio.
                        </p>
                    </div>
                    <VisibilityToggleButton />
                </div>

                {/* --- SEÇÃO 1: RESUMO SEMANAL --- */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Desempenho da Semana
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <DashboardSummaryCard
                            title="Clientes Fechados"
                            value={weeklySummary.totalClientsThisWeek}
                            icon={<Users className="w-5 h-5" />}
                            colorClass="text-blue-400"
                            isCurrency={false}
                            formatCurrency={formatCurrency}
                            gradientId="g1"
                        />
                        <DashboardSummaryCard
                            title="Vendas Fechadas"
                            value={weeklySummary.totalSalesValueThisWeek}
                            icon={<DollarSign className="w-5 h-5" />}
                            colorClass="text-green-400"
                            isCurrency={true}
                            formatCurrency={formatCurrency}
                            gradientId="g2"
                        />
                        <DashboardSummaryCard
                            title="Entradas Financeiras"
                            value={weeklySummary.totalEntradasThisWeek}
                            icon={<ArrowUp className="w-5 h-5" />}
                            colorClass="text-yellow-400"
                            isCurrency={true}
                            formatCurrency={formatCurrency}
                            gradientId="g3"
                        />
                        <DashboardSummaryCard
                            title="Saídas Totais"
                            value={weeklySummary.totalSaidasThisWeek}
                            icon={<ArrowDown className="w-5 h-5" />}
                            colorClass="text-red-400"
                            isCurrency={true}
                            formatCurrency={formatCurrency}
                            gradientId="g4"
                        />
                    </div>
                </div>

                <Separator className="bg-sidebar-border" />

                {/* --- SEÇÃO 2: FATURAMENTO X LUCRO (MENSAL) --- */}
                <div className="space-y-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Faturamento x Lucros (Últimos 4 Meses)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {monthlyPerformance.map((data, index) => (
                            <PerformanceSummaryCard
                                key={index}
                                month={data.month}
                                faturamento={data.faturamento}
                                lucro={data.lucro}
                                formatCurrency={formatCurrency}
                            />
                        ))}
                    </div>
                    
                    {/* Gráfico complementar de Faturamento Anual */}
                    <div className="mt-4">
                        <ReportChart
                            title="Faturamento Anual (Mês a Mês)"
                            data={annualPerformance.chartData}
                            series={faturamentoSeries}
                            icon={<ArrowUp className="w-5 h-5 text-green-500" />}
                            chartType="area"
                            dataKeyX="month"
                            totalValue={annualPerformance.totalFaturamentoAno}
                        />
                    </div>
                </div>

                <Separator className="bg-sidebar-border" />

                {/* --- SEÇÃO 3: VENDAS X QUANTIDADE (MENSAL) --- */}
                <div className="space-y-6">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center">
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Vendas x Quantidade (Últimos 4 Meses)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {monthlyPerformance.map((data, index) => (
                            <SalesSummaryCard
                                key={index}
                                month={data.month}
                                volumeVendas={data.volumeVendas}
                                qtdVendas={data.qtdVendas}
                                formatCurrency={formatCurrency}
                            />
                        ))}
                    </div>

                    {/* Gráfico complementar de Volume de Vendas Anual */}
                    <div className="mt-4">
                        <ReportChart
                            title="Volume de Vendas Anual (Mês a Mês)"
                            data={annualPerformance.chartData}
                            series={vendasSeries}
                            icon={<ShoppingBag className="w-5 h-5 text-blue-500" />}
                            chartType="area"
                            dataKeyX="month"
                            totalValue={annualPerformance.totalVendasAno}
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-sidebar-border/30">
                    <p className="text-[10px] text-gray-500 italic">
                        * O Lucro Real considera: Faturamento - (Custos Fixos + Custos Variáveis + Gastos Diversos). Saques de lucros de sócios não são deduzidos aqui para mostrar a capacidade de geração de caixa do negócio.
                    </p>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;