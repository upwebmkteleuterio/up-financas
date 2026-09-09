import { Contract } from "@/types/finance";
import { FilterPeriod } from "@/components/FilterDropdown";
import { createLocalDateFromISO } from "@/lib/utils";
import { isWithinInterval, startOfWeek, endOfWeek, addMonths, startOfMonth, endOfMonth, subWeeks, setMonth } from "date-fns";

/**
 * Função pura para filtrar contratos.
 */
export const filterContractsList = (
    contracts: Contract[] | undefined | null,
    searchQuery: string,
    dateFilter: FilterPeriod,
    customDateRange: { start: Date | undefined; end: Date | undefined },
    showCanceled: boolean = false
): Contract[] => {
    if (!contracts || !Array.isArray(contracts)) {
        return [];
    }

    let list = contracts;

    // 1. Filtragem por Status de Cancelamento
    // Na tela de Vendas, o usuário escolhe se quer ver ativos ou cancelados na lista.
    if (!showCanceled) {
        list = list.filter(c => !c.isCanceled);
    } else {
        list = list.filter(c => c.isCanceled);
    }

    // 2. Filtragem por Nome do Cliente ou Serviço
    if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        list = list.filter(c =>
            c.clientName.toLowerCase().includes(lowerCaseQuery) ||
            c.service.toLowerCase().includes(lowerCaseQuery)
        );
    }

    // 3. Filtragem por Data (Baseado na data de fechamento)
    let filterInterval: { start: Date; end: Date } | null = null;
    const now = new Date();
    const weekOptions = { weekStartsOn: 1 as const };

    if (dateFilter === "current_week") {
        filterInterval = { start: startOfWeek(now, weekOptions), end: endOfWeek(now, weekOptions) };
    } else if (dateFilter === "next_week") {
        const nextMonth = addMonths(now, 1);
        filterInterval = { start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) };
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
        const targetDate = setMonth(new Date(), monthIndex);
        filterInterval = { start: startOfMonth(targetDate), end: endOfMonth(targetDate) };
    } else if (dateFilter === "custom" && customDateRange.start && customDateRange.end) {
        const endDate = new Date(customDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        filterInterval = { start: customDateRange.start, end: endDate };
    }

    if (filterInterval) {
        list = list.filter((c) => {
            if (!c.dateClosed) return false; 
            const dateClosed = createLocalDateFromISO(c.dateClosed);
            return isWithinInterval(dateClosed, filterInterval!);
        });
    }

    return list;
};