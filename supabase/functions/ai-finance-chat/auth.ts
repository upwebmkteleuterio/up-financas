import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import type { Supabase } from "./types.ts";

export async function getAuthenticatedUser(request: Request, supabase: Supabase): Promise<User> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Não autenticado.");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new Error("Não autenticado.");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  return data.user;
}
