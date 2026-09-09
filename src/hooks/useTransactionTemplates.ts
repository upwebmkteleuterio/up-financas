import { useMemo, useCallback } from "react";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";

const TABLE_NAME = "transaction_templates";
const QUERY_KEY = [TABLE_NAME];

export interface TransactionTemplate {
  id: string;
  category: string;
  partnerId?: string;
  cleanDescription: string;
}

export interface TemplateToSave extends Omit<TransactionTemplate, "id"> {}

export function useTransactionTemplates() {
  const { user } = useAuth();
  
  // Query para buscar todos os templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useSupabaseQuery<TransactionTemplate>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user,
    [],
    undefined,
    undefined,
    "created_at",
    false // Mais recentes primeiro
  );

  // Mutações
  const { insert, update, remove } = useSupabaseMutation<TransactionTemplate, TemplateToSave>(
    TABLE_NAME,
    QUERY_KEY
  );

  const addTemplate = useCallback((newTemplate: TemplateToSave) => {
    insert.mutate(newTemplate);
  }, [insert]);
  
  const updateTemplate = useCallback((updatedTemplate: TransactionTemplate) => {
    update.mutate(updatedTemplate);
  }, [update]);

  const deleteTemplate = useCallback((id: string) => {
    remove.mutate(id);
  }, [remove]);

  return {
    templates,
    isLoadingTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  };
}