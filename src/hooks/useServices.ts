import { useCallback } from "react";
import { ServiceCategory } from "@/types/finance";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";

const TABLE_NAME = "service_categories";
const QUERY_KEY = [TABLE_NAME];

export function useServices() {
  const { user } = useAuth();
  
  // Query para buscar todas as categorias de serviço
  const { data: serviceCategories = [], isLoading: isLoadingServices } = useSupabaseQuery<ServiceCategory>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user,
    [],
    undefined,
    undefined,
    "name",
    true // Ordenado por nome ascendente
  );

  // Mutações
  const { insert, update, remove } = useSupabaseMutation<ServiceCategory, Omit<ServiceCategory, "id">>(
    TABLE_NAME,
    QUERY_KEY
  );

  const addServiceCategory = useCallback((name: string) => {
    const newCategory: Omit<ServiceCategory, "id"> = {
      name: name,
    };
    insert.mutate(newCategory);
  }, [insert]);
  
  const updateServiceCategory = useCallback((updatedCategory: ServiceCategory) => {
    update.mutate(updatedCategory);
  }, [update]);

  const deleteServiceCategory = useCallback((id: string) => {
    remove.mutate(id);
  }, [remove]);

  return {
    serviceCategories,
    isLoadingServices,
    addServiceCategory,
    updateServiceCategory,
    deleteServiceCategory,
  };
}