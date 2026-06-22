"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { voyageInputSchema, reservationInputSchema, shareInputSchema } from "../domain/schemas";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { FREE_VOYAGE_LIMIT } from "@/features/abonnement/domain/constants";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createVoyage(_prev: unknown, formData: FormData) {
  const parsed = voyageInputSchema.safeParse({
    titre: formData.get("titre"),
    destination: formData.get("destination") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    statut: formData.get("statut") || undefined,
  });
  if (!parsed.success) return { error: "Voyage invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  // Gating Free : limite de voyages (le trigger DB reste le garde autoritaire).
  if (!(await getIsPremium())) {
    const { count } = await supabase
      .from("voyages")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", uid);
    if ((count ?? 0) >= FREE_VOYAGE_LIMIT) return { error: "Limite Free atteinte", limit: true as const };
  }
  const { error } = await supabase.from("voyages").insert({
    owner_id: uid,
    titre: parsed.data.titre,
    destination: parsed.data.destination ?? null,
    date_debut: parsed.data.dateDebut ?? null,
    date_fin: parsed.data.dateFin ?? null,
    statut: parsed.data.statut ?? "planifie",
  });
  if (error) {
    if (error.message?.includes("limite_voyages_free")) return { error: "Limite Free atteinte", limit: true as const };
    return { error: "Création échouée" };
  }
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function updateVoyage(_prev: unknown, formData: FormData) {
  const id = formData.get("voyageId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const parsed = voyageInputSchema.safeParse({
    titre: formData.get("titre"),
    destination: formData.get("destination") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    statut: formData.get("statut") || undefined,
  });
  if (!parsed.success) return { error: "Voyage invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.from("voyages").update({
    titre: parsed.data.titre,
    destination: parsed.data.destination ?? null,
    date_debut: parsed.data.dateDebut ?? null,
    date_fin: parsed.data.dateFin ?? null,
    statut: parsed.data.statut ?? "planifie",
  }).eq("id", id);
  if (error) return { error: "Mise à jour échouée" };
  revalidatePath(`/voyages/${id}`);
  return { ok: true as const };
}

export async function deleteVoyage(_prev: unknown, formData: FormData) {
  const id = formData.get("voyageId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  // RLS delete = owner-only ; .select() détecte 0 ligne (non owner / introuvable)
  const { data, error } = await supabase.from("voyages").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function addReservation(_prev: unknown, formData: FormData) {
  const parsed = reservationInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
    type: formData.get("type"),
    fournisseur: formData.get("fournisseur") || undefined,
    reference: formData.get("reference") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    conciergerieTel: formData.get("conciergerieTel") || undefined,
    conciergerieMail: formData.get("conciergerieMail") || undefined,
    lien: formData.get("lien") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Réservation invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const d = parsed.data;
  const { error } = await supabase.from("reservations").insert({
    voyage_id: d.voyageId, created_by: uid, type: d.type,
    fournisseur: d.fournisseur ?? null, reference: d.reference ?? null,
    date_debut: d.dateDebut ?? null, date_fin: d.dateFin ?? null,
    conciergerie_tel: d.conciergerieTel ?? null, conciergerie_mail: d.conciergerieMail ?? null,
    lien: d.lien ?? null, notes: d.notes ?? null,
  });
  if (error) return { error: "Ajout de réservation échoué" };
  revalidatePath(`/voyages/${d.voyageId}`);
  return { ok: true as const };
}

export async function deleteReservation(_prev: unknown, formData: FormData) {
  const id = formData.get("reservationId");
  const voyageId = formData.get("voyageId");
  if (typeof id !== "string" || typeof voyageId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  // RLS = can_access_voyage : .select() détecte 0 ligne (réservation inaccessible/introuvable)
  const { data, error } = await supabase.from("reservations").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

export async function shareVoyage(_prev: unknown, formData: FormData) {
  const parsed = shareInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.rpc("share_voyage", {
    p_voyage_id: parsed.data.voyageId, p_email: parsed.data.email,
  });
  if (error) return { error: "Partage échoué" };
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous êtes déjà propriétaire" };
  revalidatePath(`/voyages/${parsed.data.voyageId}`);
  return { ok: true as const };
}

export async function unshareVoyage(_prev: unknown, formData: FormData) {
  const voyageId = formData.get("voyageId");
  const profileId = formData.get("profileId");
  if (typeof voyageId !== "string" || typeof profileId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("unshare_voyage", { p_voyage_id: voyageId, p_profile_id: profileId });
  if (error) return { error: "Retrait échoué" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}
