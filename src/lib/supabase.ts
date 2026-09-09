import { createClient } from "@supabase/supabase-js";

// As variáveis de ambiente são lidas do arquivo .env e expostas pelo Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Lançar um erro claro se as variáveis não estiverem definidas
  throw new Error("As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem ser definidas.");
}

// Garantir que o URL termine sem barra, embora o createClient seja tolerante
const cleanSupabaseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;

export const supabase = createClient(cleanSupabaseUrl, supabaseAnonKey);