"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { demandeRestoSchema, demandeHotelSchema, reponseSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function chercherHotels(query: string) {
  if (!query.trim()) return [];
  const supabase = await createServerSupabase();
  if (!(await userId(supabase)) || !(await getIsPremium())) return [];
  return getPlacesProvider().search(query);
}

export async function creerDemandeResto(_prev: unknown, formData: FormData) {
  const parsed = demandeRestoSchema.safeParse({
    etablissementId: formData.get("etablissementId"),
    dateResa: formData.get("dateResa"),
    heureResa: formData.get("heureResa"),
    nombreConvives: formData.get("nombreConvives"),
    avecEnfants: formData.get("avecEnfants") === "on",
    nbEnfants: formData.get("nbEnfants") || 0,
    chaiseHaute: formData.get("chaiseHaute") === "on",
    occasion: formData.get("occasion"),
    commentaire: formData.get("commentaire") || undefined,
  });
  if (!parsed.success) return { error: "Demande invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  if (!(await getIsPremium())) return { error: "Réservé aux abonnés Premium", limit: true as const };
  const d = parsed.data;
  const { error } = await supabase.from("conciergerie_demandes").insert({
    user_id: uid, type: "resto", etablissement_id: d.etablissementId,
    date_resa: d.dateResa, heure_resa: d.heureResa, nombre_convives: d.nombreConvives,
    avec_enfants: d.avecEnfants, nb_enfants: d.nbEnfants, chaise_haute: d.chaiseHaute,
    occasion: d.occasion, commentaire: d.commentaire ?? null,
  });
  if (error) return { error: "Création échouée" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}

export async function creerDemandeHotel(_prev: unknown, formData: FormData) {
  const parsed = demandeHotelSchema.safeParse({
    placeId: formData.get("placeId"),
    dateDebut: formData.get("dateDebut"),
    nombreNuits: formData.get("nombreNuits"),
    sejourType: formData.get("sejourType"),
    avecEnfants: formData.get("avecEnfants") === "on",
    nbEnfants: formData.get("nbEnfants") || 0,
    enfantsAges: formData.getAll("enfantsAges"),
    commentaire: formData.get("commentaire") || undefined,
  });
  if (!parsed.success) return { error: "Demande invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  if (!(await getIsPremium())) return { error: "Réservé aux abonnés Premium", limit: true as const };
  const d = parsed.data;
  // Résout l'hôtel sélectionné -> établissement (categorie hotel)
  const place = await getPlacesProvider().details(d.placeId);
  if (!place) return { error: "Hôtel introuvable" };
  const input = mapPlaceToEtablissement(place, "hotel");
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", { p: { ...input, enriched_at: new Date().toISOString() } });
  if (rpcErr || !etabId) return { error: "Enregistrement de l'hôtel échoué" };
  const { error } = await supabase.from("conciergerie_demandes").insert({
    user_id: uid, type: "hotel", etablissement_id: etabId,
    date_debut: d.dateDebut, nombre_nuits: d.nombreNuits, sejour_type: d.sejourType,
    avec_enfants: d.avecEnfants, nb_enfants: d.nbEnfants, enfants_ages: d.enfantsAges ?? null,
    commentaire: d.commentaire ?? null,
  });
  if (error) return { error: "Création échouée" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}

export async function repondreDemande(_prev: unknown, formData: FormData) {
  const parsed = reponseSchema.safeParse({
    demandeId: formData.get("demandeId"),
    statut: formData.get("statut"),
    reponse: formData.get("reponse") || undefined,
  });
  if (!parsed.success) return { error: "Réponse invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  // RLS update = staff-only ; .select() détecte 0 ligne (non staff)
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .update({ statut: parsed.data.statut, reponse: parsed.data.reponse ?? null, repondu_par: uid, repondu_le: new Date().toISOString() })
    .eq("id", parsed.data.demandeId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Réponse échouée" };
  if (!data) return { error: "Action réservée au concierge" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}

export async function supprimerDemande(_prev: unknown, formData: FormData) {
  const id = formData.get("demandeId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("conciergerie_demandes").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/conciergerie");
  return { ok: true as const };
}
