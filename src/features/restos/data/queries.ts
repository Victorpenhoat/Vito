import { createServerSupabase } from "@/lib/supabase/server";

export async function getMaListe() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("liste_items")
    .select("id, statut, is_favorite, etablissement:etablissements(id, nom, type, ville, arrondissement)")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getFiche(etablissementId: string) {
  const supabase = await createServerSupabase();
  const [etabRes, itemRes, avisRes] = await Promise.all([
    supabase.from("etablissements").select("*").eq("id", etablissementId).single(),
    supabase.from("liste_items").select("id, statut, is_favorite").eq("etablissement_id", etablissementId).maybeSingle(),
    supabase.from("avis").select("*").eq("etablissement_id", etablissementId).order("created_at", { ascending: false }),
  ]);
  // Un établissement introuvable n'est pas une fiche valide : on remonte l'erreur.
  if (etabRes.error) throw etabRes.error;
  if (itemRes.error) throw itemRes.error;
  if (avisRes.error) throw avisRes.error;
  return { etab: etabRes.data, item: itemRes.data, avis: avisRes.data ?? [] };
}

export async function getTags() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tags").select("id, slug, label").order("label");
  if (error) throw error;
  return data;
}
