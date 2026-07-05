"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { getLocale } from "next-intl/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { centsFromEuros } from "../domain/money";
import { computeParts } from "../domain/calculations";
import { groupeInputSchema, depenseInputSchema, remboursementInputSchema, shareGroupeSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createGroupe(_prev: unknown, formData: FormData) {
  const parsed = groupeInputSchema.safeParse({
    titre: formData.get("titre"),
    devise: formData.get("devise") || undefined,
    voyageId: formData.get("voyageId") || undefined,
  });
  if (!parsed.success) return { error: "Groupe invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { data: groupe, error } = await supabase
    .from("depense_groupes")
    .insert({ owner_id: uid, titre: parsed.data.titre, devise: parsed.data.devise ?? "EUR", voyage_id: parsed.data.voyageId ?? null })
    .select("id")
    .single();
  if (error || !groupe) { logActionError("depenses.createGroupe", error); return { error: "Création échouée" }; }
  if (parsed.data.voyageId) {
    const { data: vm } = await supabase.from("voyage_membres").select("profile_id").eq("voyage_id", parsed.data.voyageId);
    const rows = (vm ?? []).filter((m) => m.profile_id !== uid).map((m) => ({ groupe_id: groupe.id, profile_id: m.profile_id, role: "membre" as const }));
    if (rows.length) await supabase.from("depense_groupe_membres").insert(rows);
  }
  revalidatePath("/depenses");
  return { ok: true as const };
}

export async function updateGroupe(_prev: unknown, formData: FormData) {
  const id = formData.get("groupeId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const parsed = groupeInputSchema.safeParse({
    titre: formData.get("titre"),
    devise: formData.get("devise") || undefined,
  });
  if (!parsed.success) return { error: "Groupe invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("depense_groupes")
    .update({ titre: parsed.data.titre, devise: parsed.data.devise ?? "EUR" })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) { logActionError("depenses.updateGroupe", error); return { error: "Mise à jour échouée" }; }
  if (!data) return { error: "Mise à jour non autorisée" };
  revalidatePath(`/depenses/${id}`);
  return { ok: true as const };
}

export async function deleteGroupe(_prev: unknown, formData: FormData) {
  const id = formData.get("groupeId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("depense_groupes").delete().eq("id", id).select("id").maybeSingle();
  if (error) { logActionError("depenses.deleteGroupe", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/depenses");
  return { ok: true as const };
}

export async function addDepense(_prev: unknown, formData: FormData) {
  const parsed = depenseInputSchema.safeParse({
    groupeId: formData.get("groupeId"),
    payePar: formData.get("payePar"),
    libelle: formData.get("libelle"),
    montantCents: formData.get("montant"),
    date: formData.get("date") || undefined,
    mode: formData.get("mode"),
    participants: formData.getAll("participants"),
  });
  if (!parsed.success) return { error: "Dépense invalide" };
  const d = parsed.data;
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };

  let exactsCents: Record<string, number> | undefined;
  if (d.mode === "exact") {
    exactsCents = {};
    for (const pid of d.participants) {
      const raw = formData.get(`exact:${pid}`);
      const c = centsFromEuros.safeParse(typeof raw === "string" ? raw : "");
      if (!c.success) return { error: "Montant exact invalide" };
      exactsCents[pid] = c.data;
    }
  }
  let parts;
  try {
    parts = computeParts(d.montantCents, d.mode, d.participants, exactsCents);
  } catch {
    return { error: "Répartition invalide" };
  }

  const { data: dep, error } = await supabase
    .from("depenses")
    .insert({ groupe_id: d.groupeId, paye_par: d.payePar, libelle: d.libelle, montant_cents: d.montantCents, date: d.date ?? null, mode: d.mode, created_by: uid })
    .select("id")
    .single();
  if (error || !dep) { logActionError("depenses.addDepense", error); return { error: "Ajout de dépense échoué" }; }
  const rows = parts.map((p) => ({ depense_id: dep.id, profile_id: p.profileId, part_cents: p.partCents }));
  const { error: pErr } = await supabase.from("depense_parts").insert(rows);
  if (pErr) {
    logActionError("depenses.addDepense", pErr);
    await supabase.from("depenses").delete().eq("id", dep.id); // rollback best-effort
    return { error: "Enregistrement des parts échoué" };
  }
  revalidatePath(`/depenses/${d.groupeId}`);
  return { ok: true as const };
}

export async function deleteDepense(_prev: unknown, formData: FormData) {
  const id = formData.get("depenseId");
  const groupeId = formData.get("groupeId");
  if (typeof id !== "string" || typeof groupeId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("depenses").delete().eq("id", id).select("id").maybeSingle();
  if (error) { logActionError("depenses.deleteDepense", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/depenses/${groupeId}`);
  return { ok: true as const };
}

export async function addRemboursement(_prev: unknown, formData: FormData) {
  const parsed = remboursementInputSchema.safeParse({
    groupeId: formData.get("groupeId"),
    deProfileId: formData.get("deProfileId"),
    versProfileId: formData.get("versProfileId"),
    montantCents: formData.get("montant"),
    date: formData.get("date") || undefined,
  });
  if (!parsed.success) return { error: "Remboursement invalide" };
  const r = parsed.data;
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { error } = await supabase.from("remboursements").insert({
    groupe_id: r.groupeId, de_profile_id: r.deProfileId, vers_profile_id: r.versProfileId, montant_cents: r.montantCents, date: r.date ?? null, created_by: uid,
  });
  if (error) { logActionError("depenses.addRemboursement", error); return { error: "Ajout de remboursement échoué" }; }
  revalidatePath(`/depenses/${r.groupeId}`);
  return { ok: true as const };
}

export async function deleteRemboursement(_prev: unknown, formData: FormData) {
  const id = formData.get("remboursementId");
  const groupeId = formData.get("groupeId");
  if (typeof id !== "string" || typeof groupeId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("remboursements").delete().eq("id", id).select("id").maybeSingle();
  if (error) { logActionError("depenses.deleteRemboursement", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/depenses/${groupeId}`);
  return { ok: true as const };
}

export async function shareGroupe(_prev: unknown, formData: FormData) {
  const parsed = shareGroupeSchema.safeParse({ groupeId: formData.get("groupeId"), email: formData.get("email") });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.rpc("share_groupe", { p_groupe_id: parsed.data.groupeId, p_email: parsed.data.email });
  if (error) { logActionError("depenses.shareGroupe", error); return { error: "Partage échoué" }; }
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous êtes déjà propriétaire" };
  revalidatePath(`/depenses/${parsed.data.groupeId}`);
  return { ok: true as const };
}

export async function unshareGroupe(_prev: unknown, formData: FormData) {
  const groupeId = formData.get("groupeId");
  const profileId = formData.get("profileId");
  if (typeof groupeId !== "string" || typeof profileId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("unshare_groupe", { p_groupe_id: groupeId, p_profile_id: profileId });
  if (error) { logActionError("depenses.unshareGroupe", error); return { error: "Retrait échoué" }; }
  revalidatePath(`/depenses/${groupeId}`);
  return { ok: true as const };
}

// Intégration C4 : depuis le détail d'un voyage, crée (ou ouvre) le groupe lié et redirige.
export async function openVoyageGroupe(formData: FormData) {
  const voyageId = formData.get("voyageId");
  if (typeof voyageId !== "string") return;
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return;
  const { data: existing } = await supabase.from("depense_groupes").select("id").eq("voyage_id", voyageId).limit(1);
  let groupeId = existing?.[0]?.id;
  if (!groupeId) {
    const { data: v } = await supabase.from("voyages").select("titre").eq("id", voyageId).single();
    const { data: g, error } = await supabase
      .from("depense_groupes")
      .insert({ owner_id: uid, titre: v?.titre ?? "Comptes partagés", voyage_id: voyageId, devise: "EUR" })
      .select("id")
      .single();
    if (error || !g) return;
    groupeId = g.id;
    const { data: vm } = await supabase.from("voyage_membres").select("profile_id").eq("voyage_id", voyageId);
    const rows = (vm ?? []).filter((m) => m.profile_id !== uid).map((m) => ({ groupe_id: groupeId as string, profile_id: m.profile_id, role: "membre" as const }));
    if (rows.length) await supabase.from("depense_groupe_membres").insert(rows);
  }
  const locale = await getLocale();
  redirect({ href: `/depenses/${groupeId}`, locale });
}
