import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import type { Recommandation } from "../domain/reception";

/**
 * Ma boîte : les recommandations en attente. La RLS filtre déjà par
 * destinataire — ce que je lis ici est à moi par construction.
 *
 * Le nom de l'expéditeur vient de MON Cercle quand il y figure (c'est ainsi que
 * je le connais), et de son compte sinon : le lien n'étant pas symétrique,
 * quelqu'un peut m'écrire sans que je l'aie dans mon carnet.
 */
export async function getReception(): Promise<Recommandation[]> {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63)
  const auth = await getCachedUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("recommandations")
    .select("id, de_profile_id, categorie, place_id, libelle, mot, created_at, expediteur:profiles!recommandations_de_profile_id_fkey(display_name, first_name)")
    .eq("statut", "en_attente")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: proches } = await supabase
    .from("family_members")
    .select("profile_id, first_name, last_name")
    .not("profile_id", "is", null);
  const nomDeMonCercle = new Map(
    (proches ?? []).map((p) => [p.profile_id, `${p.first_name} ${p.last_name}`.trim()]),
  );

  return (data ?? []).map((r) => {
    const exp = Array.isArray(r.expediteur) ? r.expediteur[0] : r.expediteur;
    return {
      id: r.id,
      deProfileId: r.de_profile_id,
      deNom: nomDeMonCercle.get(r.de_profile_id) ?? exp?.display_name ?? exp?.first_name ?? "",
      categorie: r.categorie === "hotel" ? ("hotel" as const) : ("resto" as const),
      placeId: r.place_id,
      libelle: r.libelle,
      mot: r.mot,
      creeLe: r.created_at,
    };
  });
}

/** Combien m'attendent (compteur discret, sans charger la boîte entière). */
export async function compterReception(): Promise<number> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return 0;
  const { count } = await supabase
    .from("recommandations")
    .select("id", { count: "exact", head: true })
    .eq("statut", "en_attente");
  return count ?? 0;
}

/** Les place_id déjà dans mon carnet : une adresse déjà connue se signale. */
export async function getPlaceIdsDuCarnet(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("liste_items")
    .select("etablissement:etablissements!inner(place_id)");
  if (error) throw error;
  return (data ?? []).flatMap((r) => {
    const e = Array.isArray(r.etablissement) ? r.etablissement[0] : r.etablissement;
    return e?.place_id ? [e.place_id] : [];
  });
}

export type Envoyee = {
  id: string;
  aNom: string;
  libelle: string;
  categorie: "resto" | "hotel";
  creeLe: string;
};

/**
 * Ce que j'ai recommandé (lot 3). Volontairement SANS la suite donnée : le PO
 * a tranché que refuser ne se notifie pas, et un statut affiché ici reviendrait
 * à le notifier par la bande.
 */
export async function getEnvoyees(): Promise<Envoyee[]> {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63)
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("recommandations")
    .select("id, vers_profile_id, categorie, libelle, created_at")
    .eq("de_profile_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  // Le destinataire est nommé par MON carnet : c'est ainsi que je le connais.
  const { data: proches } = await supabase
    .from("family_members")
    .select("profile_id, first_name, last_name")
    .not("profile_id", "is", null);
  const nom = new Map((proches ?? []).map((p) => [p.profile_id, `${p.first_name} ${p.last_name}`.trim()]));

  return (data ?? []).map((r) => ({
    id: r.id,
    aNom: nom.get(r.vers_profile_id) ?? "",
    libelle: r.libelle,
    categorie: r.categorie === "hotel" ? ("hotel" as const) : ("resto" as const),
    creeLe: r.created_at,
  }));
}
