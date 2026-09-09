import { useMemo, useCallback } from "react";
import { useFinance } from "./use-finance";
import { useCosts } from "./useCosts";
import { useSales } from "./useSales";
import { usePartners } from "./usePartners";
import { FilterPeriod } from "@/components/FilterDropdown";
import { format, isWithinInterval, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks, addMonths, setMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Transaction, Contract } from "@/types/finance";
import { createLocalDateFromISO, normalizeForGrouping, capitalize } from "@/lib/utils";

// Interface para detalhes de itens no tooltip
interface DetailedItem {
    label: string;
    value: number;
}

// Função auxiliar para inicializar um mapa de datas
const initializeDateMap = (interval: { start: Date; end: Date }): Map<string, any> => {
    const map = new Map<string, any>();
    let currentDate = new Date(interval.start);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(interval.end);
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
        const formattedDate = format(currentDate, 'dd/MM', { locale: ptBR });
        map.set(formattedDate, { date: formattedDate });
        currentDate = subDays(currentDate, -1);
        if (currentDate > endDate) break;
    }
    return map;
};

// Função principal de processamento de dados para gráficos de série temporal
const processDataForChart = (
    dataList: (Transaction | Contract)[], 
    interval: { start: Date; end: Date },
    costCategoryNames: string[],
    dataType: 'transactions' | 'contracts'
) => {
    const dateMap = initializeDateMap(interval);

    // Inicializa as chaves e os arrays de detalhes
    dateMap.forEach(entry => {
        if (dataType === 'transactions') {
            entry["Entradas"] = 0; entry["Entradas_details"] = [];
            entry["Custos"] = 0; entry["Custos_details"] = [];
            entry["Gastos"] = 0; entry["Gastos_details"] = [];
            entry["Saque de Lucro"] = 0; entry["Saque de Lucro_details"] = [];
        } else if (dataType === 'contracts') {
            entry["Vendas"] = 0; entry["Vendas_details"] = [];
            entry["Recorrente"] = 0; entry["Recorrente_details"] = [];
            entry["Pontual"] = 0; entry["Pontual_details"] = [];
        }
    });

    dataList.forEach(item => {
        let dateString: string | undefined;
        let value: number = 0;
        let category: string | undefined;
        let description: string = "";
        let type: 'Entrada' | 'Saída' | 'Venda' = 'Venda';

        if ('type' in item) {
            const t = item as Transaction;
            dateString = t.date;
            value = t.value;
            category = t.category;
            description = t.description;
            type = t.type;
        } else {
            const c = item as Contract;
            dateString = c.dateClosed;
            value = c.totalContractValue;
            description = c.clientName;
            type = 'Venda';
        }
        
        if (!dateString) return;
        const itemDate = createLocalDateFromISO(dateString);
        
        if (isWithinInterval(itemDate, interval)) {
            const formattedDate = format(itemDate, 'dd/MM', { locale: ptBR });
            const entry = dateMap.get(formattedDate);

            if (entry) {
                const detail: DetailedItem = { label: description, value };
                
                if (type === 'Venda') {
                    entry["Vendas"] += value;
                    entry["Vendas_details"].push(detail);
                    
                    const contract = item as Contract;
                    if (contract.contractType === "Recorrente") {
                        entry["Recorrente"] += value;
                        entry["Recorrente_details"].push(detail);
                    } else {
                        entry["Pontual"] += value;
                        entry["Pontual_details"].push(detail);
                    }
                } else if (type === "Entrada") {
                    entry["Entradas"] += value;
                    entry["Entradas_details"].push(detail);
                } else if (type === "Saída") {
                    if (category === "Saque de Lucro") {
                        entry["Saque de Lucro"] += value;
                        entry["Saque de Lucro_details"].push(detail);
                    } else if (costCategoryNames.includes(category!)) {
                        entry["Custos"] += value;
                        entry["Custos_details"].push(detail);
                    } else {
                        entry["Gastos"] += value;
                        entry["Gastos_details"].push(detail);
                    }
                }
            }
        }
    });

    return Array.from(dateMap.values());
};

// Distribuição de Vendas por Serviço
const processServiceDistribution = (contracts: Contract[], interval: { start: Date; end: Date }) => {
    const serviceMap = new Map<string, number>();
    contracts.forEach(c => {
        if (!c.dateClosed) return;
        const dateClosed = createLocalDateFromISO(c.dateClosed);
        if (isWithinInterval(dateClosed, interval)) {
            const currentTotal = serviceMap.get(c.service) || 0;
            serviceMap.set(c.service, currentTotal + c.totalContractValue);
        }
    });
    const totalSales = Array.from(serviceMap.values()).reduce((sum, v) => sum + v, 0);
    return Array.from(serviceMap.entries()).map(([service, value]) => ({
        name: service,
        value: value,
        percentage: totalSales > 0 ? (value / totalSales) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
};

// Distribuição de Saques por Nome (com Normalização)
const processSaqueDistribution = (transactions: Transaction[], interval: { start: Date; end: Date }, partners: ReturnType<typeof usePartners>['partners']) => {
    const saqueMap = new Map<string, { label: string, value: number }>();
    
    transactions.forEach(t => {
        if (t.type !== "Saída" || t.category !== "Saque de Lucro" || !t.date) return;
        
        const date = createLocalDateFromISO(t.date);
        if (isWithinInterval(date, interval)) {
            // Lógica para extrair a descrição limpa
            let rawDescription = t.description;
            let cleanDesc = rawDescription;
            
            if (t.partnerId) {
                const partnerName = partners.find(p => p.id === t.partnerId)?.name;
                if (partnerName) {
                    const prefix = `${partnerName} - `;
                    if (rawDescription.startsWith(prefix)) {
                        cleanDesc = rawDescription.substring(prefix.length).trim();
                    } else if (rawDescription === partnerName) {
                        cleanDesc = "Saque Geral"; 
                    }
                }
            }
            
            if (!cleanDesc) cleanDesc = "Outros";

            // Normalização para Agrupamento
            const key = normalizeForGrouping(cleanDesc);
            const current = saqueMap.get(key) || { label: capitalize(cleanDesc), value: 0 };
            
            saqueMap.set(key, {
                label: current.label,
                value: current.value + t.value
            });
        }
    });
    
    const total = Array.from(saqueMap.values()).reduce((sum, item) => sum + item.value, 0);
    
    return Array.from(saqueMap.values()).map(item => ({
        name: item.label,
        value: item.value,
        percentage: total > 0 ? (item.value / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
};

const processFutureReceivables = (contracts: Contract[]) => {
    const now = new Date();
    const monthMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
        const monthDate = addMonths(startOfMonth(now), i);
        const key = format(monthDate, 'MMM/yyyy', { locale: ptBR });
        monthMap.set(key, 0);
    }
    contracts.forEach(contract => {
        if (contract.isCanceled) return;
        contract.installments.forEach(installment => {
            if (installment.isPaid || !installment.dueDate) return;
            const dueDate = createLocalDateFromISO(installment.dueDate);
            const monthKey = format(startOfMonth(dueDate), 'MMM/yyyy', { locale: ptBR });
            if (monthMap.has(monthKey)) {
                const currentTotal = monthMap.get(monthKey) || 0;
                monthMap.set(monthKey, currentTotal + installment.value);
            }
        });
    });
    return Array.from(monthMap.entries()).map(([month, value]) => ({
        month,
        "Valor a Receber": value,
    }));
};

export function useReports() {
    const { allTransactions } = useFinance();
    const { contracts } = useSales();
    const { costCategories } = useCosts();
    const { partners } = usePartners();
    
    const costCategoryNames = useMemo(() => costCategories.map(c => c.name), [costCategories]);

    const getReportData = useCallback((
        dateFilter: FilterPeriod,
        customDateRange: { start: Date | undefined; end: Date | undefined }
    ) => {
        const now = new Date();
        let filterInterval: { start: Date; end: Date } | null = null;
        const weekOptions = { weekStartsOn: 1 as const }; 

        if (dateFilter === "current_week") {
            filterInterval = { start: startOfWeek(now, weekOptions), end: endOfWeek(now, weekOptions) };
        } else if (dateFilter === "last_week") {
            const lastWeek = subWeeks(now, 1);
            filterInterval = { start: startOfWeek(lastWeek, weekOptions), end: endOfWeek(lastWeek, weekOptions) };
        } else if (dateFilter === "current_month") {
            filterInterval = { start: startOfMonth(now), end: endOfMonth(now) };
        } else if (dateFilter === "last_month") {
            const lastMonth = subMonths(now, 1);
            filterInterval = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
        } else if (dateFilter.startsWith("month_")) {
            const monthIndex = parseInt(dateFilter.split("_")[1]);
            const targetDate = setMonth(new Date(), monthIndex);
            filterInterval = { start: startOfMonth(targetDate), end: endOfMonth(targetDate) };
        } else if (dateFilter === "custom" && customDateRange.start && customDateRange.end) {
            const endDate = new Date(customDateRange.end);
            endDate.setHours(23, 59, 59, 999);
            filterInterval = { start: customDateRange.start, end: endDate };
        } else {
            filterInterval = { start: startOfWeek(now, weekOptions), end: endOfWeek(now, weekOptions) };
        }
        
        if (!filterInterval) return { 
            saídaData: [], saqueData: [], vendasData: [], entradasData: [],
            serviceDistribution: [], recurrenceData: [], futureReceivables: [], saqueDistribution: []
        };

        const transactionData = processDataForChart(allTransactions, filterInterval, costCategoryNames, 'transactions');
        const contractData = processDataForChart(contracts, filterInterval, costCategoryNames, 'contracts');

        return { 
            saídaData: transactionData.map(d => ({ 
                date: d.date, 
                Custos: d.Custos, Custos_details: d.Custos_details,
                Gastos: d.Gastos, Gastos_details: d.Gastos_details 
            })),
            saqueData: transactionData.map(d => ({ 
                date: d.date, 
                "Saque de Lucro": d["Saque de Lucro"], 
                "Saque de Lucro_details": d["Saque de Lucro_details"] 
            })),
            vendasData: contractData.map(d => ({ 
                date: d.date, 
                "Vendas": d.Vendas, 
                "Vendas_details": d.Vendas_details 
            })),
            entradasData: transactionData.map(d => ({ 
                date: d.date, 
                "Entradas": d.Entradas, 
                "Entradas_details": d.Entradas_details 
            })),
            serviceDistribution: processServiceDistribution(contracts, filterInterval),
            recurrenceData: contractData.map(d => ({ 
                date: d.date, 
                Recorrente: d.Recorrente, Recorrente_details: d.Recorrente_details,
                Pontual: d.Pontual, Pontual_details: d.Pontual_details 
            })),
            futureReceivables: processFutureReceivables(contracts),
            saqueDistribution: processSaqueDistribution(allTransactions, filterInterval, partners),
        };
    }, [allTransactions, contracts, costCategoryNames, partners]);

    return { getReportData };
}