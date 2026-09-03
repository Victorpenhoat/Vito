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

export type CompteAdmin = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  statut: string;
  created_at: string | null;
  derniere_connexion: string | null;
};

/**
 * Comptes de l'instance (écran « Comptes », administrateur seulement).
 * La fonction serveur ne renvoie QUE l'identité et l'état — aucun contenu :
 * l'administrateur gère les accès, pas les carnets.
 */
export async function getComptesAdmin(): Promise<CompteAdmin[]> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase.rpc("admin_lister_comptes");
  if (error) throw error;
  return (data ?? []) as CompteAdmin[];
}

/** Comptages affichés à l'étape 1 de la suppression (« ce qui part »). */
export async function getInventaireCompte(): Promise<{
  adresses: number; voyages: number; vins: number; proches: number;
}> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return { adresses: 0, voyages: 0, vins: 0, proches: 0 };
  // La RLS restreint chaque comptage à l'utilisateur courant.
  const [adresses, voyages, vins, proches] = await Promise.all([
    supabase.from("liste_items").select("id", { count: "exact", head: true }),
    supabase.from("voyages").select("id", { count: "exact", head: true }),
    supabase.from("vins").select("id", { count: "exact", head: true }),
    supabase.from("family_members").select("id", { count: "exact", head: true }),
  ]);
  return {
    adresses: adresses.count ?? 0,
    voyages: voyages.count ?? 0,
    vins: vins.count ?? 0,
    proches: proches.count ?? 0,
  };
}
