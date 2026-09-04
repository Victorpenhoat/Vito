"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  voyageInputSchema, reservationInputSchema, shareInputSchema,
  participantInputSchema, etapeInputSchema,
  depenseVoyageInputSchema, remboursementVoyageInputSchema,
} from "../domain/schemas";
import { centsFromEuros } from "@/features/depenses/domain/money";
import { partsEgales, partsExactes } from "../domain/depensesVoyage";
import { ajouterAuCarnet } from "@/features/places/data/ajouterAuCarnet";
import { champsDuType } from "../domain/reservationDetails";
import { TYPES_HEBERGEMENT } from "../domain/reservationHebergement";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { FREE_VOYAGE_LIMIT } from "@/features/abonnement/domain/constants";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function parseVoyage(formData: FormData) {
  return voyageInputSchema.safeParse({
    titre: formData.get("titre"),
    destination: formData.get("destination") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    statut: formData.get("statut") || undefined,
    periodeTexte: formData.get("periodeTexte") || undefined,
    coverPhotoRef: formData.get("coverPhotoRef") || undefined,
    coverUrl: formData.get("coverUrl") || undefined,
  });
}

// cover : une seule source (contrainte voyages_cover_unique) — la ref Places
// prime, l'URL libre sinon ; l'autre est explicitement remise à null.
function voyageValues(d: ReturnType<typeof parseVoyage> extends { data?: infer T } ? NonNullable<T> : never) {
  return {
    titre: d.titre,
    destination: d.destination ?? null,
    date_debut: d.dateDebut ?? null,
    date_fin: d.dateFin ?? null,
    periode_texte: d.periodeTexte ?? null,
    cover_photo_ref: d.coverPhotoRef ?? null,
    cover_url: d.coverPhotoRef ? null : (d.coverUrl ?? null),
  };
}

export async function createVoyage(_prev: unknown, formData: FormData) {
  const parsed = parseVoyage(formData);
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
    ...voyageValues(parsed.data),
    statut: parsed.data.statut ?? "planifie",
  });
  if (error) {
    if (error.message?.includes("limite_voyages_free")) return { error: "Limite Free atteinte", limit: true as const };
    logActionError("voyages.createVoyage", error);
    return { error: "Création échouée" };
  }
  revalidatePath("/voyages");
  return { ok: true as const };
}

export async function updateVoyage(_prev: unknown, formData: FormData) {
  const id = formData.get("voyageId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const parsed = parseVoyage(formData);
  if (!parsed.success) return { error: "Voyage invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.from("voyages").update({
    ...voyageValues(parsed.data),
    statut: parsed.data.statut ?? "planifie",
  }).eq("id", id);
  if (error) { logActionError("voyages.updateVoyage", error); return { error: "Mise à jour échouée" }; }
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
  if (error) { logActionError("voyages.deleteVoyage", error); return { error: "Suppression échouée" }; }
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
    placeId: formData.get("placeId") || undefined,
  });
  if (!parsed.success) return { error: "Réservation invalide" };

  // Détails propres au type (Lot C) : seuls les champs DU TYPE sont retenus,
  // et seulement s'ils portent quelque chose. Le formulaire peut envoyer les
  // champs d'un autre type quand on en change en cours de saisie.
  const details: Record<string, string> = {};
  for (const champ of champsDuType(String(formData.get("type") ?? ""))) {
    const v = formData.get(`details_${champ}`);
    if (typeof v === "string" && v.trim()) details[champ] = v.trim().slice(0, 200);
  }
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const d = parsed.data;

  // Hôtels v2 (H6) : un hébergement désigné rejoint le carnet, avec l'origine
  // « Ajouté via Voyages · <titre> ». Le titre est lu SOUS RLS : c'est aussi ce
  // qui vérifie que ce voyage m'est accessible avant d'écrire quoi que ce soit
  // (une FK ne garantit aucun accès).
  let etablissementId: string | null = null;
  if (d.placeId && TYPES_HEBERGEMENT.includes(d.type)) {
    const { data: voyage } = await supabase
      .from("voyages").select("titre").eq("id", d.voyageId).maybeSingle();
    if (!voyage) return { error: "Voyage inaccessible" };
    const ajout = await ajouterAuCarnet(supabase, uid, d.placeId, "hotel", {
      origine: { type: "voyage", qui: voyage.titre },
    });
    if ("error" in ajout) { logActionError("voyages.addReservation", ajout.error); return { error: ajout.error }; }
    etablissementId = ajout.etablissementId;
  }

  const { error } = await supabase.from("reservations").insert({
    voyage_id: d.voyageId, created_by: uid, type: d.type,
    fournisseur: d.fournisseur ?? null, reference: d.reference ?? null,
    date_debut: d.dateDebut ?? null, date_fin: d.dateFin ?? null,
    conciergerie_tel: d.conciergerieTel ?? null, conciergerie_mail: d.conciergerieMail ?? null,
    lien: d.lien ?? null, notes: d.notes ?? null,
    etablissement_id: etablissementId,
    details: Object.keys(details).length > 0 ? details : null,
  });
  if (error) { logActionError("voyages.addReservation", error); return { error: "Ajout de réservation échoué" }; }
  revalidatePath(`/voyages/${d.voyageId}`);
  // L'hôtel vient d'entrer au carnet : sa liste et sa fiche doivent le montrer.
  if (etablissementId) revalidatePath("/hotels", "layout");
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
  if (error) { logActionError("voyages.deleteReservation", error); return { error: "Suppression échouée" }; }
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
  if (error) { logActionError("voyages.shareVoyage", error); return { error: "Partage échoué" }; }
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
  if (error) { logActionError("voyages.unshareVoyage", error); return { error: "Retrait échoué" }; }
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

// ── Lot B : participants et programme ───────────────────────────────────────

export async function addParticipant(_prev: unknown, formData: FormData) {
  const parsed = participantInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
    profileId: formData.get("profileId") || undefined,
    familyMemberId: formData.get("familyMemberId") || undefined,
    displayName: formData.get("displayName"),
    email: formData.get("email") || undefined,
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { error: "Participant invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const d = parsed.data;

  // La FK family_members ne garantit AUCUN accès (les FK ignorent la RLS) : on
  // vérifie l'appartenance par un SELECT sous RLS — pattern setOrigine.
  if (d.familyMemberId) {
    const { data: proche } = await supabase
      .from("family_members").select("id").eq("id", d.familyMemberId).maybeSingle();
    if (!proche) return { error: "Proche introuvable" };
  }

  // L'id revient à l'appelant : l'écran affiche la ligne sans attendre un
  // rafraîchissement RSC qui, sous charge, peut ne jamais se commettre (#71/#77).
  const { data: cree, error } = await supabase.from("voyage_participants").insert({
    voyage_id: d.voyageId,
    profile_id: d.profileId ?? null,
    family_member_id: d.familyMemberId ?? null,
    display_name: d.displayName,
    email: d.email ?? null,
    role: d.role ?? "voyageur",
    created_by: uid,
  }).select("id").single();
  if (error) {
    logActionError("voyages.addParticipant", error);
    // 23505 = l'index unique partiel : ce proche (ou ce compte) est déjà du voyage.
    return { error: error.code === "23505" ? "Déjà participant" : "Ajout du participant échoué" };
  }
  revalidatePath(`/voyages/${d.voyageId}`);
  return { ok: true as const, id: cree?.id as string };
}

export async function removeParticipant(_prev: unknown, formData: FormData) {
  const id = formData.get("participantId");
  const voyageId = formData.get("voyageId");
  if (typeof id !== "string" || typeof voyageId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  // RLS = can_access_voyage : .select() détecte 0 ligne (participant inaccessible)
  const { data, error } = await supabase
    .from("voyage_participants").delete().eq("id", id).select("id").maybeSingle();
  if (error) { logActionError("voyages.removeParticipant", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

export async function addEtape(_prev: unknown, formData: FormData) {
  const parsed = etapeInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
    jour: formData.get("jour") || undefined,
    heure: formData.get("heure") || undefined,
    titre: formData.get("titre"),
    lieu: formData.get("lieu") || undefined,
    etablissementId: formData.get("etablissementId") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Étape invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const d = parsed.data;

  // Rang dans la journée : à la suite de ce qui y est déjà. Deux étapes créées
  // au même instant peuvent partager un rang — l'affichage reste stable, elles
  // se départagent alors par leur heure ou par leur ordre d'insertion.
  const dejaLa = supabase
    .from("voyage_etapes")
    .select("id", { count: "exact", head: true })
    .eq("voyage_id", d.voyageId);
  // `eq` ne compare pas NULL en SQL : les étapes « à caler » se comptent avec `is`.
  const { count } = await (d.jour ? dejaLa.eq("jour", d.jour) : dejaLa.is("jour", null));

  const { data: cree, error } = await supabase.from("voyage_etapes").insert({
    voyage_id: d.voyageId,
    jour: d.jour ?? null,
    heure: d.heure ?? null,
    titre: d.titre,
    lieu: d.lieu ?? null,
    etablissement_id: d.etablissementId ?? null,
    notes: d.notes ?? null,
    ordre: count ?? 0,
    created_by: uid,
  }).select("id").single();
  if (error) { logActionError("voyages.addEtape", error); return { error: "Ajout de l'étape échoué" }; }
  revalidatePath(`/voyages/${d.voyageId}`);
  return { ok: true as const, id: cree?.id as string, ordre: count ?? 0 };
}

export async function removeEtape(_prev: unknown, formData: FormData) {
  const id = formData.get("etapeId");
  const voyageId = formData.get("voyageId");
  if (typeof id !== "string" || typeof voyageId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("voyage_etapes").delete().eq("id", id).select("id").maybeSingle();
  if (error) { logActionError("voyages.removeEtape", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

// ── Lot D : dépenses du voyage ──────────────────────────────────────────────

export async function addDepenseVoyage(_prev: unknown, formData: FormData) {
  const parsed = depenseVoyageInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
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

  let parts;
  try {
    if (d.mode === "exact") {
      const exacts: Record<string, number> = {};
      for (const pid of d.participants) {
        const brut = formData.get(`exact:${pid}`);
        const c = centsFromEuros.safeParse(typeof brut === "string" ? brut : "");
        if (!c.success) return { error: "Montant exact invalide" };
        exacts[pid] = c.data;
      }
      parts = partsExactes(d.montantCents, exacts);
    } else {
      parts = partsEgales(d.montantCents, d.participants);
    }
  } catch {
    // computeParts lève quand la somme des exacts ne fait pas le total
    return { error: "Répartition invalide" };
  }

  const { data: dep, error } = await supabase
    .from("voyage_depenses")
    .insert({
      voyage_id: d.voyageId, paye_par: d.payePar, libelle: d.libelle,
      montant_cents: d.montantCents, date: d.date ?? null, mode: d.mode, created_by: uid,
    })
    .select("id")
    .single();
  if (error || !dep) { logActionError("voyages.addDepense", error); return { error: "Ajout de dépense échoué" }; }

  const { error: pErr } = await supabase.from("voyage_depense_parts").insert(
    parts.map((p) => ({ depense_id: dep.id, participant_id: p.participantId, part_cents: p.partCents })),
  );
  if (pErr) {
    logActionError("voyages.addDepense", pErr);
    // Une dépense sans ses parts fausserait tous les soldes : on la retire.
    await supabase.from("voyage_depenses").delete().eq("id", dep.id);
    return { error: "Enregistrement des parts échoué" };
  }
  revalidatePath(`/voyages/${d.voyageId}`);
  return { ok: true as const, id: dep.id };
}

export async function removeDepenseVoyage(_prev: unknown, formData: FormData) {
  const id = formData.get("depenseId");
  const voyageId = formData.get("voyageId");
  if (typeof id !== "string" || typeof voyageId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("voyage_depenses").delete().eq("id", id).select("id").maybeSingle();
  if (error) { logActionError("voyages.removeDepense", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

export async function addRemboursementVoyage(_prev: unknown, formData: FormData) {
  const parsed = remboursementVoyageInputSchema.safeParse({
    voyageId: formData.get("voyageId"),
    deParticipantId: formData.get("deParticipantId"),
    versParticipantId: formData.get("versParticipantId"),
    montantCents: formData.get("montant"),
    date: formData.get("date") || undefined,
  });
  if (!parsed.success) return { error: "Remboursement invalide" };
  const r = parsed.data;
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { data: cree, error } = await supabase.from("voyage_remboursements").insert({
    voyage_id: r.voyageId, de_participant_id: r.deParticipantId,
    vers_participant_id: r.versParticipantId, montant_cents: r.montantCents,
    date: r.date ?? null, created_by: uid,
  }).select("id").single();
  if (error) { logActionError("voyages.addRemboursement", error); return { error: "Remboursement non enregistré" }; }
  revalidatePath(`/voyages/${r.voyageId}`);
  return { ok: true as const, id: cree?.id as string };
}
