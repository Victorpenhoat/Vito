"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";
import { familleInputSchema, inviteSchema, procheInputSchema } from "../domain/schemas";
import { avatarColor } from "../domain/avatarColor";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// id de la famille de l'utilisateur (possédée ou rejointe), ou null
async function maFamilleId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.from("familles").select("id, owner_id").maybeSingle();
  return data ?? null;
}

export async function creerFamille(_prev: unknown, formData: FormData) {
  const parsed = familleInputSchema.safeParse({ nom: formData.get("nom") });
  if (!parsed.success) return { error: "Nom invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { error } = await supabase.from("familles").insert({ owner_id: uid, nom: parsed.data.nom });
  if (error) {
    // le trigger owner-membre viole UNIQUE(profile_id) si déjà dans une famille
    if (error.code === "23505" || error.message?.includes("unique")) return { error: "Vous êtes déjà dans une famille" };
    return { error: "Création échouée" };
  }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function inviterMembre(_prev: unknown, formData: FormData) {
  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { data, error } = await supabase.rpc("inviter_famille", { p_famille_id: fam.id, p_email: parsed.data.email });
  if (error) return { error: "Invitation échouée" };
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous êtes déjà membre" };
  if (data === "deja_famille") return { error: "Cette personne est déjà dans une famille" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function retirerMembre(_prev: unknown, formData: FormData) {
  const profileId = formData.get("profileId");
  if (typeof profileId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.rpc("retirer_membre_famille", { p_famille_id: fam.id, p_profile_id: profileId });
  if (error) return { error: "Retrait échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function quitterFamille(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("quitter_famille");
  if (error) return { error: "Impossible de quitter" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function supprimerFamille(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  // RLS delete = owner-only ; .select() détecte 0 ligne (non owner)
  const { data, error } = await supabase.from("familles").delete().eq("id", fam.id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function ajouterRestoFiche(_prev: unknown, formData: FormData) {
  const etablissementId = formData.get("etablissementId");
  if (typeof etablissementId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.from("famille_restos").upsert(
    { famille_id: fam.id, etablissement_id: etablissementId, added_by: uid },
    { onConflict: "famille_id,etablissement_id" },
  );
  if (error) return { error: "Ajout échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function ajouterRestoRecherche(_prev: unknown, formData: FormData) {
  const placeId = formData.get("placeId");
  if (typeof placeId !== "string" || !placeId) return { error: "Place invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const place = await getPlacesProvider().details(placeId);
  if (!place) return { error: "Établissement introuvable" };
  const input = mapPlaceToEtablissement(place);
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", { p: { ...input, enriched_at: new Date().toISOString() } });
  if (rpcErr || !etabId) return { error: "Enregistrement échoué" };
  const { error } = await supabase.from("famille_restos").upsert(
    { famille_id: fam.id, etablissement_id: etabId, added_by: uid },
    { onConflict: "famille_id,etablissement_id" },
  );
  if (error) return { error: "Ajout échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function retirerResto(_prev: unknown, formData: FormData) {
  const etablissementId = formData.get("etablissementId");
  if (typeof etablissementId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.from("famille_restos").delete().eq("famille_id", fam.id).eq("etablissement_id", etablissementId);
  if (error) return { error: "Retrait échoué" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function chercherEtablissements(query: string) {
  if (!query.trim()) return [];
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return [];
  return getPlacesProvider().search(query);
}

function clean(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function creerProche(_prev: unknown, formData: FormData) {
  const parsed = procheInputSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    relation: formData.get("relation"),
    circle: formData.get("circle"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    birth_date: formData.get("birth_date") ?? "",
  });
  if (!parsed.success) return { error: "Champs invalides" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const p = parsed.data;
  const { data, error } = await supabase
    .from("family_members")
    .insert({
      user_id: uid,
      first_name: p.first_name,
      last_name: p.last_name,
      relation: p.relation,
      circle: p.circle,
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
      birth_date: clean(formData.get("birth_date")),
      avatar_color: avatarColor(`${p.first_name} ${p.last_name}`),
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Création échouée" };
  revalidatePath("/famille");
  redirect(`/famille/proches/${data.id}`);
}

export async function modifierProche(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const parsed = procheInputSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    relation: formData.get("relation"),
    circle: formData.get("circle"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    birth_date: formData.get("birth_date") ?? "",
  });
  if (!parsed.success) return { error: "Champs invalides" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const p = parsed.data;
  const { data, error } = await supabase
    .from("family_members")
    .update({
      first_name: p.first_name,
      last_name: p.last_name,
      relation: p.relation,
      circle: p.circle,
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
      birth_date: clean(formData.get("birth_date")),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Modification échouée" };
  if (!data) return { error: "Introuvable" };
  revalidatePath("/famille");
  revalidatePath(`/famille/proches/${id}`);
  redirect(`/famille/proches/${id}`);
}

export async function supprimerProche(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.from("family_members").delete().eq("id", id);
  if (error) return { error: "Suppression échouée" };
  revalidatePath("/famille");
  redirect("/famille");
}
