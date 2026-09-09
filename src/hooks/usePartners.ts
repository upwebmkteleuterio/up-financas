import { useState, useMemo, useCallback } from "react";
import { Partner } from "@/types/finance";
import { isSameMonth, parseISO } from "date-fns";
import { useFinance } from "./use-finance";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";

const TABLE_NAME = "partners";
const QUERY_KEY = [TABLE_NAME];

export function usePartners() {
  const { user } = useAuth();
  const { allTransactions: transactions } = useFinance(); // Corrigido para usar allTransactions

  // Query para buscar todos os sócios
  const { data: partners = [], isLoading: isLoadingPartners } = useSupabaseQuery<Partner>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user
  );

  // Mutações
  const { insert: insertMutation, update, remove } = useSupabaseMutation<Partner, Omit<Partner, "id" | "isActive">>(
    TABLE_NAME,
    QUERY_KEY
  );

  // Função wrapper para a mutação de inserção
  const addPartner = useCallback((newPartner: Omit<Partner, "id" | "isActive">, options?: { onSuccess?: (data: Partner) => void }) => {
    // Adiciona isActive: true e envia o objeto camelCase
    const partnerToInsert = { ...newPartner, isActive: true };
    // Chama a mutação com o onSuccess opcional
    insertMutation.mutate(partnerToInsert as any, options);
  }, [insertMutation]);
  
  const updatePartner = useCallback((updatedPartner: Partner) => {
    // Envia o objeto camelCase completo
    update.mutate(updatedPartner);
  }, [update]);

  const deletePartner = useCallback((id: string) => {
    remove.mutate(id);
    // NOTA: Transações antigas com este partnerId permanecerão, mas o nome não será resolvido.
  }, [remove]);

  const togglePartnerActive = useCallback((id: string) => {
    const partner = partners.find(p => p.id === id);
    if (partner) {
        const newIsActive = !partner.isActive;
        
        // Envia o objeto camelCase completo com o estado atualizado
        const updatedPartner = { ...partner, isActive: newIsActive };
        
        update.mutate(updatedPartner);
    }
  }, [partners, update]);

  const getPartnerNameById = useCallback((id: string) => {
    return partners.find(p => p.id === id)?.name;
  }, [partners]);

  const summary = useMemo(() => {
    const currentMonth = new Date();
    
    // 1. Total de Saques de Lucro no Mês Corrente
    const monthlySaques = transactions
      .filter(t => 
        t.category === "Saque de Lucro" && 
        t.date && // Adicionando verificação de data para segurança
        isSameMonth(parseISO(t.date), currentMonth)
      );

    const totalSaquesCurrentMonth = monthlySaques.reduce((sum, t) => sum + t.value, 0);

    // 2. Saques por Sócio no Mês Corrente
    const saquesByPartner = partners.map(partner => {
      const totalSaques = monthlySaques
        .filter(t => t.partnerId === partner.id)
        .reduce((sum, t) => sum + t.value, 0);
      
      return {
        ...partner,
        totalSaquesCurrentMonth: totalSaques,
      };
    });

    return {
      totalSaquesCurrentMonth,
      saquesByPartner,
    };
  }, [partners, transactions]);

  return {
    partners,
    isLoadingPartners,
    addPartner,
    updatePartner,
    deletePartner,
    togglePartnerActive,
    getPartnerNameById,
    summary,
  };
}