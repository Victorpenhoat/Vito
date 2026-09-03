import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";

export type SessionAppareil = {
  id: string;
  created_at: string | null;
  refreshed_at: string | null;
  user_agent: string | null;
  ip: string | null;
  courante: boolean;
};

export type ConnexionRecente = {
  cree_le: string | null;
  action: string | null;
  ip: string | null;
};

/** Appareils connectés (design écran 15). Les données viennent du schéma auth,
 *  via une fonction limitée à l'appelant — aucune clé de service côté app. */
export async function getMesSessions(): Promise<SessionAppareil[]> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase.rpc("mes_sessions");
  if (error) throw error;
  return (data ?? []) as SessionAppareil[];
}

/** Connexions récentes (design écran 14). */
export async function getMesConnexions(limite = 10): Promise<ConnexionRecente[]> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase.rpc("mes_connexions_recentes", { p_limite: limite });
  if (error) throw error;
  return (data ?? []) as ConnexionRecente[];
}
