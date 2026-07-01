import { createServerSupabase } from "@/lib/supabase/server";

const SELECT = "id, type, statut, etablissement_id, date_resa, heure_resa, nombre_convives, occasion, avec_enfants, nb_enfants, chaise_haute, date_debut, nombre_nuits, sejour_type, enfants_ages, commentaire, reponse, repondu_le, created_at, user_id, etablissement:etablissements(nom, ville)";

export async function getMesDemandes() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .select(SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInboxConciergerie() {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : protégé en amont par le check staff de la page,
  // mais on garde par cohérence — sans session, la lecture renverrait 42501.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  // RLS : un membre du staff (is_concierge) voit toutes les demandes ; sinon seulement les siennes.
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDemande(id: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("conciergerie_demandes").select(SELECT).eq("id", id).single();
  if (error) throw error;
  return data;
}
