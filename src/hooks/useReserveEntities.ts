import { useCallback } from "react";
import { CashReserveEntity } from "@/types/finance";
import { useSupabaseQuery, useSupabaseMutation } from "./useSupabaseQuery";
import { useAuth } from "./useAuth";

const TABLE_NAME = "cash_reserve_entities";
const QUERY_KEY = [TABLE_NAME];

export function useReserveEntities() {
  const { user } = useAuth();
  
  const { data: entities = [], isLoading } = useSupabaseQuery<CashReserveEntity>(
    TABLE_NAME,
    QUERY_KEY,
    "*",
    !!user
  );
  
  const { insert, update, remove } = useSupabaseMutation<CashReserveEntity, Omit<CashReserveEntity, "id" | "userId">>(
    TABLE_NAME,
    QUERY_KEY
  );
  
  const addEntity = useCallback((data: Omit<CashReserveEntity, "id" | "userId">) => {
    if (!user) return;
    insert.mutate({ ...data, userId: user.id } as any);
  }, [insert, user]);
  
  const updateEntity = useCallback((data: CashReserveEntity) => {
    update.mutate(data);
  }, [update]);
  
  const deleteEntity = useCallback((id: string) => {
    remove.mutate(id);
  }, [remove]);

  return {
    entities,
    isLoading,
    addEntity,
    updateEntity,
    deleteEntity
  };
}