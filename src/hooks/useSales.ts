import { useState, useMemo, useCallback, useEffect } from "react";
import { Contract, ContractInstallment, Transaction } from "@/types/finance";
import { useFinance } from "./use-finance";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";
import { showSuccess } from "@/utils/toast";
import { createLocalDateFromISO } from "@/lib/utils";
import { isPast, isToday, startOfDay, parseISO, addMonths, format } from "date-fns";

export const getInstallmentReceived = (installment: ContractInstallment): number =>
  installment.paidValue ?? (installment.isPaid ? installment.value : 0);

export const getInstallmentRemaining = (installment: ContractInstallment): number =>
  Math.max(0, installment.value - getInstallmentReceived(installment));

export const getContractRemaining = (contract: Contract): number =>
  (contract.installments || []).reduce((sum, installment) => sum + getInstallmentRemaining(installment), 0);

export const getInstallmentPaidInfo = (installment: ContractInstallment) => {
  const received = getInstallmentReceived(installment);
  const original = installment.originalValue ?? installment.value;
  return { received, original, isPartial: installment.isPaid && received < original };
};

const TABLE_NAME = "contracts";
const QUERY_KEY = [TABLE_NAME];

export function useSales() {
  const { user } = useAuth();
  const { addTransaction, updateTransaction, deleteTransaction, allTransactions } = useFinance();

  const { data: rawContracts, isLoading: isLoadingContracts } = useSupabaseQuery<Contract>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user
  );
  
  const contracts = rawContracts ?? [];

  const { insert: insertMutation, update, remove } = useSupabaseMutation<Contract, Omit<Contract, "id" | "isCanceled">>(
    TABLE_NAME,
    QUERY_KEY
  );

  const handleFinancialEntry = useCallback((contract: Contract, isNew: boolean) => {
    const installments = contract.installments || [];
    const firstInstallment = installments[0];
    
    const existingTransaction = allTransactions.find(t => 
      t.sourceContractId === contract.id && t.isAutomated
    );

    if (!firstInstallment) return contract;

    if (contract.launchFinancialEntry) {
        const descriptionSuffix = contract.contractType === "Fixo" 
            ? "(Fixo - Pagamento Único)" 
            : "(1ª Parcela)";

        const newTransactionData: Omit<Transaction, "id"> = {
            type: "Entrada",
            category: "Vendas",
            description: `${contract.clientName} - ${contract.service} ${descriptionSuffix}`,
            value: firstInstallment.value,
            date: firstInstallment.dueDate, 
            paymentMethod: "Pix", 
            notes: contract.notes ? `Venda: ${contract.notes}` : undefined,
            isAutomated: true,
            sourceContractId: contract.id,
            contractInstallment: {
                installmentId: firstInstallment.id,
                number: 1,
                total: installments.length,
                isResidual: firstInstallment.isResidual === true,
                isPartial: false,
                referenceNumber: firstInstallment.generatedFromNumber,
                originalValue: firstInstallment.value,
                receivedValue: firstInstallment.value,
            },
        };

        if (existingTransaction) {
            updateTransaction({ ...newTransactionData, id: existingTransaction.id });
        } else if (isNew || !existingTransaction) {
            addTransaction(newTransactionData);
        }
        
        const updatedInstallments = installments.map((i, index) => 
            index === 0 ? { ...i, isPaid: true } : i
        );
        
        return { ...contract, installments: updatedInstallments };
        
    } else if (existingTransaction) {
        deleteTransaction(existingTransaction.id);
        
        const updatedInstallments = installments.map((i, index) => 
            index === 0 ? { ...i, isPaid: false } : i
        );
        return { ...contract, installments: updatedInstallments };
    }
    
    return contract;
  }, [addTransaction, updateTransaction, deleteTransaction, allTransactions]);

  const insert = useMemo(() => {
    return {
        ...insertMutation,
        mutate: (newContract: Omit<Contract, "id" | "isCanceled">) => {
            const contractToInsert = { ...newContract, isCanceled: false };
            insertMutation.mutate(contractToInsert, {
                onSuccess: (insertedContract) => {
                    const contractToUpdate = handleFinancialEntry(insertedContract as Contract, true);
                    if (contractToUpdate.installments && contractToUpdate.installments[0]?.isPaid) {
                        update.mutate(contractToUpdate);
                    }
                }
            });
        }
    };
  }, [insertMutation, handleFinancialEntry, update]);

  const addContract = useCallback((newContract: Omit<Contract, "id">): Contract => {
    insert.mutate(newContract);
    return { ...newContract, id: Date.now().toString(), isCanceled: false } as Contract; 
  }, [insert]);
  
  const updateContract = useCallback((updatedContract: Contract) => {
    const contractToSave = handleFinancialEntry(updatedContract, false);
    update.mutate(contractToSave);
  }, [update, handleFinancialEntry]);

  const deleteContract = useCallback((id: string) => {
    const automatedTransaction = allTransactions.find(t => t.sourceContractId === id && t.isAutomated);
    if (automatedTransaction) {
        deleteTransaction(automatedTransaction.id);
    }
    remove.mutate(id);
  }, [remove, allTransactions, deleteTransaction]);

  const markInstallmentAsPaid = useCallback((
    contractId: string,
    installmentId: string,
    paymentDate: Date,
    paidValue: number,
    remainderAction?: 'add_to_next' | 'create_new',
    newInstallmentDate?: Date
  ) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    let updatedInstallments = [...(contract.installments || [])];
    const installmentIndex = updatedInstallments.findIndex(i => i.id === installmentId);
    if (installmentIndex === -1) return;

    const installment = updatedInstallments[installmentIndex];
    const installmentNumber = installmentIndex + 1;
    const installmentTotal = updatedInstallments.length;
    const isPartial = paidValue < installment.value && paidValue > 0;
    const isResidual = installment.isResidual === true;
    const remainder = installment.value - paidValue;

    // 1. Atualiza a parcela atual
    updatedInstallments[installmentIndex] = {
        ...installment,
        ...(isPartial ? { originalValue: installment.originalValue ?? installment.value } : {}),
        value: paidValue,
        paidValue: paidValue,
        paidDate: paymentDate.toISOString().split("T")[0],
        isPaid: true
    };

    // 2. Lança no financeiro o valor REAL recebido
    const descriptionPrefix = isResidual
        ? "Recebimento de Resíduo"
        : isPartial
            ? "Recebimento Parcial"
            : "Recebimento";
    const descriptionSuffix = `(Parcela ${installmentNumber} de ${installmentTotal}${isResidual && installment.generatedFromNumber ? `, resíduo da parcela ${installment.generatedFromNumber}` : ''})`;

    const newTransaction: Omit<Transaction, "id"> = {
        type: "Entrada",
        category: "Vendas",
        description: `${descriptionPrefix} - ${contract.clientName} - ${contract.service} ${descriptionSuffix}`,
        value: paidValue,
        date: paymentDate.toISOString().split("T")[0],
        paymentMethod: "Pix",
        notes: `Recebimento de parcela do contrato ${contract.id}. Valor original: ${installment.value}`,
        sourceContractId: contract.id,
        contractInstallment: {
            installmentId,
            number: installmentNumber,
            total: installmentTotal,
            isResidual,
            isPartial,
            referenceNumber: isResidual ? installment.generatedFromNumber : undefined,
            originalValue: installment.value,
            receivedValue: paidValue,
        },
    };
    addTransaction(newTransaction);

    // 3. Trata o resíduo se for parcial
    if (isPartial) {
        if (remainderAction === 'add_to_next') {
            // Tenta encontrar a próxima parcela pendente
            const nextInstallmentIndex = updatedInstallments.findIndex((i, idx) => idx > installmentIndex && !i.isPaid);
            if (nextInstallmentIndex !== -1) {
                updatedInstallments[nextInstallmentIndex] = {
                    ...updatedInstallments[nextInstallmentIndex],
                    value: updatedInstallments[nextInstallmentIndex].value + remainder
                };
            } else {
                // Se não houver próxima, cria uma nova com ID único mais robusto
                updatedInstallments.push({
                    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    value: remainder,
                    dueDate: format(addMonths(parseISO(installment.dueDate), 1), 'yyyy-MM-dd'),
                    isPaid: false,
                    isResidual: true,
                    generatedFrom: installmentId,
                    generatedFromNumber: installmentNumber,
                });
            }
        } else if (remainderAction === 'create_new' && newInstallmentDate) {
            updatedInstallments.push({
                id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                value: remainder,
                dueDate: newInstallmentDate.toISOString().split("T")[0],
                isPaid: false,
                isResidual: true,
                generatedFrom: installmentId,
                generatedFromNumber: installmentNumber,
            });
        }
    }
    
    const updatedContract = { ...contract, installments: updatedInstallments };
    update.mutate(updatedContract);
  }, [contracts, update, addTransaction]);
  
  const cancelContract = useCallback((
    contractFromUI: Contract, 
    installmentIdsToCancel: string[]
  ) => {
    const contractToCancel = contracts.find(c => c.id === contractFromUI.id) || contractFromUI;
    const updatedContract: Contract = {
        ...contractToCancel,
        isCanceled: true,
        launchFinancialEntry: false, 
    };
    update.mutate(updatedContract);
    showSuccess(`Contrato de ${contractToCancel.clientName} cancelado.`);
  }, [contracts, update]);

  const summary = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const currentMonthPrefix = now.toISOString().slice(0, 7);
    
    const contractsClosedCurrentMonth = contracts.filter((c) => 
        c.dateClosed && c.dateClosed.startsWith(currentMonthPrefix)
    );

    const totalContractsValue = contractsClosedCurrentMonth.reduce((sum, c) => sum + c.totalContractValue, 0);
    const numberOfSales = contractsClosedCurrentMonth.length;

    // Novos KPIs específicos para Contratos Ativos
    let totalAReceber = 0;
    let totalEmAtraso = 0;
    let totalRecebidoAtivos = 0;

    contracts.forEach(c => {
        if (c.isCanceled) return;

        const isFinished = getContractRemaining(c) <= 0;

        // Se o contrato não está finalizado nem cancelado, ele é ATIVO
        if (!isFinished) {
            c.installments.forEach(i => {
                const received = getInstallmentReceived(i);
                const remaining = getInstallmentRemaining(i);
                if (received > 0) totalRecebidoAtivos += received;
                if (remaining > 0) {
                    totalAReceber += remaining;
                    const dueDate = createLocalDateFromISO(i.dueDate);
                    if (isPast(dueDate) && !isToday(dueDate)) totalEmAtraso += remaining;
                }
            });
        }
    });

    return {
      totalContractsCurrentMonth: totalContractsValue,
      totalSalesCurrentMonth: totalContractsValue,
      numberOfSales,
      averageTicketCurrentMonth: numberOfSales > 0 ? totalContractsValue / numberOfSales : 0,
      // Novos valores
      totalAReceber,
      totalEmAtraso,
      totalRecebidoAtivos
    };
  }, [contracts]); 

  return {
    contracts,
    isLoadingContracts,
    addContract,
    updateContract,
    deleteContract,
    markInstallmentAsPaid,
    cancelContract,
    summary,
  };
}