import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { useAuth } from "./useAuth";
import { keysToSnakeCase, keysToCamelCase } from "@/lib/utils"; // Importando utilitários de conversão
// import { PostgrestFilterBuilder } from "@supabase/postgrest-js"; // Removido

// Tipagem genérica para dados do Supabase
type SupabaseData = Record<string, any>;

// Tipo para filtros dinâmicos
interface SupabaseFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'ilike';
  value: any;
}

/**
 * Hook para buscar dados de uma tabela do Supabase.
 * @param tableName Nome da tabela.
 * @param queryKey Chave única para o cache do React Query.
 * @param selectQuery String de seleção (ex: '*, profiles(name)').
 * @param enabled Se a query deve ser executada.
 * @param filters Array de filtros a serem aplicados.
 * @param limit Limite de resultados por página.
 * @param offset Deslocamento para paginação.
 * @param orderBy Coluna para ordenação (padrão: 'created_at').
 * @param ascending Direção da ordenação (padrão: false - descendente).
 */
export function useSupabaseQuery<T extends SupabaseData>(
  tableName: string,
  queryKey: (string | number)[],
  selectQuery: string = "*",
  enabled: boolean = true,
  filters: SupabaseFilter[] = [],
  limit?: number,
  offset?: number,
  orderBy: string = "created_at",
  ascending: boolean = false
) {
  const { user } = useAuth();
  
  const fetcher = async (): Promise<T[]> => {
    if (!user) return [];
    
    let query: any = supabase
      .from(tableName)
      .select(selectQuery)
      .order(orderBy, { ascending: ascending }); // Usando os novos parâmetros de ordenação

    // Aplica filtros dinâmicos
    filters.forEach(filter => {
      // Correção TS2349: Forçar a tipagem do método de filtro
      query = (query[filter.operator] as any)(filter.column, filter.value);
    });
    
    // Aplica paginação
    if (limit !== undefined && offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
    } else if (limit !== undefined) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      // Loga o erro para debug
      console.error(`Erro ao buscar ${tableName}:`, error);
      throw new Error(`Erro ao buscar ${tableName}: ${error.message}`);
    }
    
    // Converte as chaves de snake_case para camelCase
    // Correção TS2352: Usar 'as unknown as T[]' para forçar a conversão
    return (data as unknown as T[]).map(keysToCamelCase) as T[];
  };

  return useQuery<T[], Error>({
    queryKey: [...queryKey, ...filters.map(f => `${f.column}:${f.value}`), limit, offset, orderBy, ascending], // Adiciona ordenação à chave de cache
    queryFn: fetcher,
    enabled: enabled && !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });
}

/**
 * Hook para mutações (INSERT, UPDATE, DELETE) no Supabase.
 * @param tableName Nome da tabela.
 * @param queryKey Chave de invalidação do cache.
 */
export function useSupabaseMutation<T extends SupabaseData, V = T>(
  tableName: string,
  queryKey: (string | number)[]
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const insertMutation = useMutation<T, Error, V>({
    mutationFn: async (data: V) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      // 1. Converte os dados de camelCase para snake_case
      const snakeCaseData = keysToSnakeCase(data);
      
      // 2. Adiciona o user_id automaticamente
      const dataWithUserId = { ...snakeCaseData, user_id: user.id };
      
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(dataWithUserId)
        .select()
        .single();

      if (error) {
        throw new Error(`Falha ao inserir em ${tableName}: ${error.message}`);
      }
      // Converte o resultado de volta para camelCase
      return keysToCamelCase(result) as T; 
    },
    onSuccess: (data) => { // data agora é o objeto inserido
      // Invalida todas as queries que começam com a chave base da tabela
      queryClient.invalidateQueries({ queryKey: [tableName], refetchType: 'all' });
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const updateMutation = useMutation<T, Error, T>({
    mutationFn: async (data: T) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      // 1. Converte os dados de camelCase para snake_case
      const snakeCaseData = keysToSnakeCase(data);
      
      // 2. Remove o user_id do payload de update (já está no WHERE)
      // CRÍTICO: Garante que o payload é um objeto antes de desestruturar
      if (Array.isArray(snakeCaseData) || typeof snakeCaseData !== 'object' || snakeCaseData === null) {
          throw new Error("Payload de atualização inválido: esperado objeto.");
      }
      
      const { user_id, ...updatePayload } = snakeCaseData;
      
      const { data: result, error } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq("id", data.id)
        .eq("user_id", user.id) // Adicionado para RLS de propriedade
        .select()
        .single();

      if (error) {
        throw new Error(`Falha ao atualizar ${tableName}: ${error.message}`);
      }
      // Converte o resultado de volta para camelCase
      return keysToCamelCase(result) as T;
    },
    onSuccess: () => {
      // Invalida todas as queries que começam com a chave base da tabela
      queryClient.invalidateQueries({ queryKey: [tableName], refetchType: 'all' });
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      // Adiciona user_id na cláusula WHERE para garantir que o RLS de propriedade seja satisfeito
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id); // Adicionado para RLS de propriedade

      if (error) {
        throw new Error(`Falha ao deletar de ${tableName}: ${error.message}`);
      }
    },
    onSuccess: () => {
      // Invalida todas as queries que começam com a chave base da tabela
      queryClient.invalidateQueries({ queryKey: [tableName], refetchType: 'all' });
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  return {
    insert: insertMutation,
    update: updateMutation,
    remove: deleteMutation,
  };
}