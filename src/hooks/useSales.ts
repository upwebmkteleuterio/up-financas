import { useState, useMemo, useCallback, useEffect } from "react";
import { Contract, ContractInstallment, Transaction } from "@/types/finance";
import { useFinance } from "./use-finance";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";
import { showSuccess } from "@/utils/toast";
import { createLocalDateFromISO } from "@/lib/utils";
import { isPast, isToday, startOfDay, parseISO, addMonths, format } from "date-fns";

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
    const isPartial = paidValue < installment.value && paidValue > 0;
    const remainder = installment.value - paidValue;

    // 1. Atualiza a parcela atual
    updatedInstallments[installmentIndex] = {
        ...installment,
        paidValue: paidValue,
        paidDate: paymentDate.toISOString().split("T")[0],
        // Se for parcial, mantemos isPaid como false para que ela ainda apareça como pendente ou parcial no sistema
        // Mas o usuário quer que ela mude de status. Vamos definir que isPaid: true significa que "foi processada"
        isPaid: true
    };

    // 2. Lança no financeiro o valor REAL recebido
    const newTransaction: Omit<Transaction, "id"> = {
        type: "Entrada",
        category: "Vendas",
        description: `${isPartial ? 'Recebimento Parcial' : 'Recebimento'} - ${contract.clientName} - ${contract.service} (Parcela ${installmentId.slice(-4)})`,
        value: paidValue,
        date: paymentDate.toISOString().split("T")[0],
        paymentMethod: "Pix",
        notes: `Recebimento de parcela do contrato ${contract.id}. Valor original: ${installment.value}`,
        sourceContractId: contract.id,
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
                    isPaid: false
                });
            }
        } else if (remainderAction === 'create_new' && newInstallmentDate) {
            updatedInstallments.push({
                id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                value: remainder,
                dueDate: newInstallmentDate.toISOString().split("T")[0],
                isPaid: false
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

        const totalPaid = c.installments.reduce((sum, i) => sum + (i.paidValue || (i.isPaid ? i.value : 0)), 0);
        const isFinished = (c.totalContractValue - totalPaid) <= 0;

        // Se o contrato não está finalizado nem cancelado, ele é ATIVO
        if (!isFinished) {
            c.installments.forEach(i => {
                if (i.isPaid) {
                    totalRecebidoAtivos += (i.paidValue || i.value);
                } else {
                    totalAReceber += i.value;
                    const dueDate = createLocalDateFromISO(i.dueDate);
                    if (isPast(dueDate) && !isToday(dueDate)) {
                        totalEmAtraso += i.value;
                    }
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