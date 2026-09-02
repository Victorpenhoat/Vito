import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";

export async function getFiche(etablissementId: string) {
  const supabase = await createServerSupabase();
  // Fail-safe anon : layout et page rendent en parallèle (App Router), donc le
  // requireRole du layout ne garde pas ces requêtes. Sans session, les tables
  // (etablissements/liste_items/avis, authenticated-only) renvoient 42501 (anon)
  // et crashent le RSC. FicheResto gère déjà `!etab` (notFound) ; on court-circuite.
  const auth = await getCachedUser();
  if (!auth.user) {
    return { etab: null, item: null, avis: [], appliedTagIds: [] as string[], visites: [] };
  }
  const [etabRes, itemRes, avisRes] = await Promise.all([
    supabase.from("etablissements").select("*").eq("id", etablissementId).single(),
    supabase.from("liste_items")
      .select("id, statut, is_favorite, is_archived, origine_type, origine_qui, origine_family_member_id, origine_source, etoiles, prix_nuit, checkin_heure, checkout_heure")
      .eq("etablissement_id", etablissementId).maybeSingle(),
    supabase.from("avis").select("*").eq("etablissement_id", etablissementId).order("created_at", { ascending: false }),
  ]);
  // Un établissement introuvable n'est pas une fiche valide : on remonte l'erreur.
  if (etabRes.error) throw etabRes.error;
  if (itemRes.error) throw itemRes.error;
  if (avisRes.error) throw avisRes.error;

  // Récupère les tags appliqués et les visites de l'item (si l'item existe).
  let appliedTagIds: string[] = [];
  let visites: {
    id: string; note: number | null; commentaire: string | null; visite_le: string;
    date_fin: string | null; voyage_id: string | null; adultes: number | null; enfants: number | null; chambres: number | null;
    voyage: { id: string; titre: string } | null;
  }[] = [];
  if (itemRes.data) {
    const [tagRes, visRes] = await Promise.all([
      supabase.from("liste_item_tags").select("tag_id").eq("liste_item_id", itemRes.data.id),
      supabase.from("visites")
        // Hôtels v2 : séjour = plage de dates + voyage lié (titre via join sous RLS)
        .select("id, note, commentaire, visite_le, date_fin, voyage_id, adultes, enfants, chambres, voyage:voyages(id, titre)")
        .eq("liste_item_id", itemRes.data.id)
        .order("visite_le", { ascending: false }),
    ]);
    if (tagRes.error) throw tagRes.error;
    if (visRes.error) throw visRes.error;
    appliedTagIds = (tagRes.data ?? []).map((r) => r.tag_id);
    visites = visRes.data ?? [];
  }

  return { etab: etabRes.data, item: itemRes.data, avis: avisRes.data ?? [], appliedTagIds, visites };
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

// Tags v2 : liste d'administration avec portée, propriété et nombre d'usages.
// Le count de liste_item_tags est restreint aux items du user par la RLS.
export async function getTagsAvecUsage() {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("tags")
    .select("id, slug, label, color, scope, is_system, user_id, usages:liste_item_tags(count)")
    .order("label");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    slug: t.slug,
    label: t.label,
    color: t.color,
    scope: t.scope as "common" | "restaurant" | "hotel",
    is_system: t.is_system,
    user_id: t.user_id,
    usages: (t.usages?.[0] as { count?: number } | undefined)?.count ?? 0,
  }));
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
