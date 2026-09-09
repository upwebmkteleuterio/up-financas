import { useMemo } from "react";
import { useSales } from "./useSales";
import { useFinance } from "./use-finance";
import { parseISO, isWithinInterval, subDays, startOfWeek, endOfWeek, isSameDay, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createLocalDateFromISO } from "@/lib/utils";

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function useDashboard() {
    const { contracts } = useSales();
    const { allTransactions } = useFinance();

    const now = new Date();
    const weekOptions = { weekStartsOn: 1 as const }; 
    
    // Intervalo da Semana Atual
    const startOfCurrentWeek = startOfWeek(now, weekOptions);
    const endOfCurrentWeek = endOfWeek(now, weekOptions);

    // --- 1. Cards de Resumo Semanal ---
    const weeklySummary = useMemo(() => {
        const contractsThisWeek = contracts.filter(c => {
            if (!c.dateClosed) return false;
            const dateClosed = createLocalDateFromISO(c.dateClosed);
            return isWithinInterval(dateClosed, { start: startOfCurrentWeek, end: endOfCurrentWeek });
        });
        
        const totalClientsThisWeek = contractsThisWeek.length;
        const totalSalesValueThisWeek = contractsThisWeek.reduce((sum, c) => sum + c.totalContractValue, 0);

        const transactionsThisWeek = allTransactions.filter(t => {
            if (!t.date) return false;
            const transactionDate = createLocalDateFromISO(t.date);
            return isWithinInterval(transactionDate, { start: startOfCurrentWeek, end: endOfCurrentWeek });
        });
        
        const totalEntradasThisWeek = transactionsThisWeek
            .filter(t => t.type === "Entrada")
            .reduce((sum, t) => sum + t.value, 0);
            
        const totalSaidasThisWeek = transactionsThisWeek
            .filter(t => t.type === "Saída")
            .reduce((sum, t) => sum + t.value, 0);

        return {
            totalClientsThisWeek,
            totalSalesValueThisWeek,
            totalEntradasThisWeek,
            totalSaidasThisWeek,
        };
    }, [contracts, allTransactions, startOfCurrentWeek, endOfCurrentWeek]);

    // --- 2. Desempenho Mensal (Últimos 4 meses) ---
    const monthlyPerformance = useMemo(() => {
        const performanceData = [];

        // Loop de 3 meses atrás até o mês atual (total 4 meses)
        for (let i = 3; i >= 0; i--) {
            const targetMonthDate = subMonths(now, i);
            const monthStart = startOfMonth(targetMonthDate);
            const monthEnd = endOfMonth(targetMonthDate);
            const monthName = format(targetMonthDate, "MMMM", { locale: ptBR });
            const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            // 1. Filtra transações do mês para Faturamento e Lucro
            const monthTransactions = allTransactions.filter(t => {
                if (!t.date) return false;
                const tDate = createLocalDateFromISO(t.date);
                return isWithinInterval(tDate, { start: monthStart, end: monthEnd });
            });

            const faturamento = monthTransactions
                .filter(t => t.type === "Entrada")
                .reduce((sum, t) => sum + t.value, 0);

            const saidasNegocio = monthTransactions
                .filter(t => t.type === "Saída" && t.category !== "Saque de Lucro")
                .reduce((sum, t) => sum + t.value, 0);

            const lucro = faturamento - saidasNegocio;

            // 2. Filtra contratos do mês para Volume e Qtd de Vendas
            const monthContracts = contracts.filter(c => {
                if (!c.dateClosed) return false;
                const cDate = createLocalDateFromISO(c.dateClosed);
                return isWithinInterval(cDate, { start: monthStart, end: monthEnd });
            });

            const volumeVendas = monthContracts.reduce((sum, c) => sum + c.totalContractValue, 0);
            const qtdVendas = monthContracts.length;

            performanceData.push({
                month: monthLabel,
                faturamento,
                lucro,
                volumeVendas,
                qtdVendas,
            });
        }

        return performanceData;
    }, [allTransactions, contracts]);

    // --- 3. Desempenho Anual de Faturamento e Vendas (12 meses do ano atual) ---
    const annualPerformance = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const monthsAbbreviated = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        
        let totalFaturamentoAno = 0;
        let totalVendasAno = 0;
        
        const chartData = monthsAbbreviated.map((monthName, monthIndex) => {
            // Faturamento do mês
            const monthTransactions = allTransactions.filter(t => {
                if (!t.date) return false;
                const tDate = createLocalDateFromISO(t.date);
                return tDate.getFullYear() === currentYear && tDate.getMonth() === monthIndex;
            });
            const faturamento = monthTransactions
                .filter(t => t.type === "Entrada")
                .reduce((sum, t) => sum + t.value, 0);
            totalFaturamentoAno += faturamento;

            // Vendas do mês
            const monthContracts = contracts.filter(c => {
                if (!c.dateClosed) return false;
                const cDate = createLocalDateFromISO(c.dateClosed);
                return cDate.getFullYear() === currentYear && cDate.getMonth() === monthIndex;
            });
            const volumeVendas = monthContracts.reduce((sum, c) => sum + c.totalContractValue, 0);
            totalVendasAno += volumeVendas;

            return {
                month: monthName,
                Faturamento: faturamento,
                Vendas: volumeVendas
            };
        });

        return {
            chartData,
            totalFaturamentoAno,
            totalVendasAno
        };
    }, [allTransactions, contracts]);

    return {
        weeklySummary,
        monthlyPerformance,
        annualPerformance,
        formatCurrency,
    };
}