import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";

export async function getFiche(etablissementId: string) {
  const supabase = await createServerSupabase();
  // Fail-safe anon : layout et page rendent en parallèle (App Router), donc le
  // requireRole du layout ne garde pas ces requêtes. Sans session, les tables
  // (etablissements/liste_items/avis, authenticated-only) renvoient 42501 (anon)
  // et crashent le RSC. FicheResto gère déjà `!etab` (notFound) ; on court-circuite.
  const auth = await getCachedUser();
  if (!auth.user) {
    return { etab: null, item: null, avis: [], appliedTagIds: [] as string[] };
  }
  const [etabRes, itemRes, avisRes] = await Promise.all([
    supabase.from("etablissements").select("*").eq("id", etablissementId).single(),
    supabase.from("liste_items").select("id, statut, is_favorite, is_archived").eq("etablissement_id", etablissementId).maybeSingle(),
    supabase.from("avis").select("*").eq("etablissement_id", etablissementId).order("created_at", { ascending: false }),
  ]);
  // Un établissement introuvable n'est pas une fiche valide : on remonte l'erreur.
  if (etabRes.error) throw etabRes.error;
  if (itemRes.error) throw itemRes.error;
  if (avisRes.error) throw avisRes.error;

  // Récupère les tags appliqués à l'item de l'utilisateur (si l'item existe).
  let appliedTagIds: string[] = [];
  if (itemRes.data) {
    const { data: tagRows, error: tagErr } = await supabase
      .from("liste_item_tags")
      .select("tag_id")
      .eq("liste_item_id", itemRes.data.id);
    if (tagErr) throw tagErr;
    appliedTagIds = (tagRows ?? []).map((r) => r.tag_id);
  }

  return { etab: etabRes.data, item: itemRes.data, avis: avisRes.data ?? [], appliedTagIds };
}

export async function getTags() {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : `tags` est authenticated-only (GRANT 00005) ;
  // sans session la lecture renvoie 42501 (anon) et crashe le RSC (gouts/page).
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase.from("tags").select("id, slug, label").order("label");
  if (error) throw error;
  return data;
}

export async function getTagsForCategory(category: "restaurant" | "hotel") {
  const supabase = await createServerSupabase();
  // Fail-safe anon : `tags` est authenticated-only. Cette lecture est dans le même
  // Promise.all que getFiche (gardé #61) dans FicheResto — non gardée, elle faisait
  // throw tout le Promise.all et crashait la fiche EN ANON malgré #61. On court-circuite.
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("tags")
    .select("id, slug, label, color")
    .or(`scope.eq.common,scope.eq.${category}`)
    .order("label");
  if (error) throw error;
  return data ?? [];
}
