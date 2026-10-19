import { useMemo, useCallback } from "react";
import { ContractInstallment } from "@/types/finance";
import { useSales, getInstallmentRemaining, getInstallmentReceived, getInstallmentPaidInfo } from "./useSales";
import { isSameMonth, startOfMonth, endOfMonth, addMonths, isWithinInterval, format, startOfWeek, endOfWeek, addWeeks, subWeeks, setMonth } from "date-fns";
import { FilterPeriod } from "@/components/FilterDropdown";
import { ptBR } from "date-fns/locale";
import { createLocalDateFromISO } from "@/lib/utils";

interface Recebimento extends ContractInstallment {
    contractId: string;
    clientName: string;
    service: string;
    dueDate: string;
    hasNextInstallment: boolean;
    remaining: number;
}

interface Recebido extends ContractInstallment {
    contractId: string;
    clientName: string;
    service: string;
    dueDate: string;
    receivedValue: number;
    receivedDate: string;
    isPartial: boolean;
}

export function useRecebimentos() {
    const { contracts } = useSales();

    const allRecebimentos = useMemo(() => {
        const list: Recebimento[] = [];

        contracts.forEach(contract => {
            if (contract.isCanceled) return;

            contract.installments.forEach((installment, index) => {
                const remaining = getInstallmentRemaining(installment);
                if (remaining <= 0 || !installment.dueDate) return;

                const isFirstInstallment = index === 0;
                const isExcludedByAutomation = isFirstInstallment && contract.launchFinancialEntry;

                if (!isExcludedByAutomation) {
                    const hasNextInstallment = contract.installments.slice(index + 1).some(i => !i.isPaid);

                    list.push({
                        ...installment,
                        contractId: contract.id,
                        clientName: contract.clientName,
                        service: contract.service,
                        hasNextInstallment,
                        remaining
                    });
                }
            });
        });

        return list.sort((a, b) => {
            const dateA = a.dueDate ? createLocalDateFromISO(a.dueDate).getTime() : 0;
            const dateB = b.dueDate ? createLocalDateFromISO(b.dueDate).getTime() : 0;
            return dateA - dateB;
        });
    }, [contracts]);

    const allRecebidos = useMemo(() => {
        const list: Recebido[] = [];

        contracts.forEach(contract => {
            if (contract.isCanceled) return;

            contract.installments.forEach(installment => {
                const receivedValue = getInstallmentReceived(installment);
                if (receivedValue <= 0) return;

                list.push({
                    ...installment,
                    contractId: contract.id,
                    clientName: contract.clientName,
                    service: contract.service,
                    dueDate: installment.dueDate,
                    receivedValue,
                    receivedDate: installment.paidDate ?? installment.dueDate,
                    isPartial: getInstallmentPaidInfo(installment).isPartial
                });
            });
        });

        return list.sort((a, b) =>
            createLocalDateFromISO(b.receivedDate).getTime() - createLocalDateFromISO(a.receivedDate).getTime()
        );
    }, [contracts]);

    const summary = useMemo(() => {
        const now = new Date();
        const currentMonth = startOfMonth(now);

        const totalRecebimentosCurrentMonth = allRecebimentos
            .filter(r =>
                r.dueDate && isSameMonth(createLocalDateFromISO(r.dueDate), currentMonth)
            )
            .reduce((sum, r) => sum + r.remaining, 0);

        const futureMonths = [1, 2, 3].map(offset => {
            const monthDate = addMonths(currentMonth, offset);
            const monthName = format(monthDate, "MMMM/yyyy", { locale: ptBR });

            const total = allRecebimentos
                .filter(r =>
                    r.dueDate && isSameMonth(createLocalDateFromISO(r.dueDate), monthDate)
                )
                .reduce((sum, r) => sum + r.remaining, 0);

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

    const filterList = useCallback(<T extends { clientName: string; service: string; dueDate: string; receivedDate?: string }>(
        source: T[],
        dateField: "dueDate" | "receivedDate",
        searchQuery: string,
        dateFilter: FilterPeriod,
        customDateRange: { start: Date | undefined; end: Date | undefined }
    ) => {
        let list = source;

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
            const targetDate = setMonth(startOfMonth(now), monthIndex);
            filterInterval = { start: startOfMonth(targetDate), end: endOfMonth(targetDate) };
        } else if (dateFilter === "custom" && customDateRange.start && customDateRange.end) {
            const endDate = new Date(customDateRange.end);
            endDate.setHours(23, 59, 59, 999);
            filterInterval = { start: customDateRange.start, end: endDate };
        }

        if (filterInterval) {
            list = list.filter(r => {
                const date = r[dateField];
                if (!date) return false;
                return isWithinInterval(createLocalDateFromISO(date), filterInterval!);
            });
        }

        return list;
    }, []);

    const filterRecebimentos = useCallback((
        searchQuery: string,
        dateFilter: FilterPeriod,
        customDateRange: { start: Date | undefined; end: Date | undefined }
    ) => filterList(allRecebimentos, "dueDate", searchQuery, dateFilter, customDateRange), [allRecebimentos, filterList]);

    const filterRecebidos = useCallback((
        searchQuery: string,
        dateFilter: FilterPeriod,
        customDateRange: { start: Date | undefined; end: Date | undefined }
    ) => filterList(allRecebidos, "receivedDate", searchQuery, dateFilter, customDateRange), [allRecebidos, filterList]);

    return {
        recebimentos: allRecebimentos,
        recebidos: allRecebidos,
        filterRecebimentos,
        filterRecebidos,
        summary,
    };
}
