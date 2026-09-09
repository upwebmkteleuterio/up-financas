import { useMemo, useCallback } from "react";
import { Contract, ContractInstallment } from "@/types/finance";
import { useSales } from "./useSales";
import { parseISO, isSameMonth, startOfMonth, endOfMonth, addMonths, isWithinInterval, format, startOfWeek, endOfWeek, addWeeks, subWeeks, setMonth } from "date-fns";
import { FilterPeriod } from "@/components/FilterDropdown";
import { ptBR } from "date-fns/locale"; 
import { createLocalDateFromISO } from "@/lib/utils";

interface Recebimento extends ContractInstallment {
    contractId: string;
    clientName: string;
    service: string;
    dueDate: string;
    hasNextInstallment: boolean;
}

export function useRecebimentos() {
    const { contracts } = useSales();

    const allRecebimentos = useMemo(() => {
        const list: Recebimento[] = [];

        contracts.forEach(contract => {
            
            // REGRA: Se o contrato estiver cancelado, ele não gera recebimentos futuros na lista.
            if (contract.isCanceled) return;
            
            contract.installments.forEach((installment, index) => {
                
                // 1. Se já foi paga, não é um recebimento pendente.
                if (installment.isPaid) return;
                
                // 2. Se não tem data, ignora.
                if (!installment.dueDate) return;

                // 3. Regra de Automação (Primeira parcela já lançada)
                const isFirstInstallment = index === 0;
                const isExcludedByAutomation = isFirstInstallment && contract.launchFinancialEntry;

                if (!isExcludedByAutomation) {
                    // Verifica se existe uma PRÓXIMA parcela pendente no mesmo contrato
                    const hasNextInstallment = contract.installments.slice(index + 1).some(i => !i.isPaid);

                    list.push({
                        ...installment,
                        contractId: contract.id,
                        clientName: contract.clientName,
                        service: contract.service,
                        hasNextInstallment
                    });
                }
            });
        });

        // Ordenar por data de vencimento
        return list.sort((a, b) => {
            const dateA = a.dueDate ? createLocalDateFromISO(a.dueDate).getTime() : 0;
            const dateB = b.dueDate ? createLocalDateFromISO(b.dueDate).getTime() : 0;
            return dateA - dateB;
        });
    }, [contracts]);

    const summary = useMemo(() => {
        const now = new Date();
        const currentMonth = startOfMonth(now);
        
        const totalRecebimentosCurrentMonth = allRecebimentos
            .filter(r => 
                r.dueDate && isSameMonth(createLocalDateFromISO(r.dueDate), currentMonth)
            )
            .reduce((sum, r) => sum + r.value, 0);

        const futureMonths = [1, 2, 3].map(offset => {
            const monthDate = addMonths(currentMonth, offset);
            const monthName = format(monthDate, "MMMM/yyyy", { locale: ptBR });
            
            const total = allRecebimentos
                .filter(r => 
                    r.dueDate && isSameMonth(createLocalDateFromISO(r.dueDate), monthDate)
                )
                .reduce((sum, r) => sum + r.value, 0);

            return {
                monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                total,
            };
        });

        return {
            totalRecebimentosCurrentMonth,
            futureMonths,
        };
    }, [allRecebimentos]);

    const filterRecebimentos = useCallback((
        searchQuery: string, 
        dateFilter: FilterPeriod,
        customDateRange: { start: Date | undefined; end: Date | undefined }
    ) => {
        let list = allRecebimentos;

        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            list = list.filter(r => 
                r.clientName.toLowerCase().includes(lowerCaseQuery) ||
                r.service.toLowerCase().includes(lowerCaseQuery)
            );
        }

        let filterInterval: { start: Date; end: Date } | null = null;
        const now = new Date();
        const weekOptions = { weekStartsOn: 1 as const }; 

        if (dateFilter === "current_week") {
            filterInterval = { start: startOfWeek(now, weekOptions), end: endOfWeek(now, weekOptions) };
        } else if (dateFilter === "next_week") {
            const nextWeek = addWeeks(now, 1);
            filterInterval = { start: startOfWeek(nextWeek, weekOptions), end: endOfWeek(nextWeek, weekOptions) };
        } else if (dateFilter === "last_week") {
            const lastWeek = subWeeks(now, 1);
            filterInterval = { start: startOfWeek(lastWeek, weekOptions), end: endOfWeek(lastWeek, weekOptions) };
        } else if (dateFilter === "current_month") {
            filterInterval = { start: startOfMonth(now), end: endOfMonth(now) };
        } else if (dateFilter === "last_month") {
            const lastMonth = addMonths(now, -1);
            filterInterval = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
        } else if (dateFilter === "next_month") {
            const nextMonth = addMonths(now, 1);
            filterInterval = { start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) };
        } else if (dateFilter.startsWith("month_")) {
            const monthIndex = parseInt(dateFilter.split("_")[1]);
            // Usamos startOfMonth no new Date() para garantir que estamos no dia 1 antes de trocar o mês,
            // evitando o problema de overflow (ex: 31 de Outubro -> Fevereiro vira Março)
            const targetDate = setMonth(startOfMonth(now), monthIndex);
            filterInterval = { start: startOfMonth(targetDate), end: endOfMonth(targetDate) };
        } else if (dateFilter === "custom" && customDateRange.start && customDateRange.end) {
            const endDate = new Date(customDateRange.end);
            endDate.setHours(23, 59, 59, 999);
            filterInterval = { start: customDateRange.start, end: endDate };
        }

        if (filterInterval) {
            list = list.filter((r) => {
                if (!r.dueDate) return false; 
                const dueDate = createLocalDateFromISO(r.dueDate);
                return isWithinInterval(dueDate, filterInterval!);
            });
        }

        return list;
    }, [allRecebimentos]);

    return {
        recebimentos: allRecebimentos,
        filterRecebimentos,
        summary,
    };
}