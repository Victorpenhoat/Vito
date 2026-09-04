import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";

export async function getMesVoyages() {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : layout et page rendent en parallèle ; sans
  // session, voyages renvoie 42501 (anon) et crashe le RSC. On court-circuite.
  const auth = await getCachedUser();
  if (!auth.user) return [];
  // RLS (can_access_voyage) renvoie automatiquement les voyages possédés + partagés.
  const { data, error } = await supabase
    .from("voyages")
    .select("id, titre, destination, date_debut, date_fin, statut, owner_id, periode_texte, cover_photo_ref, cover_url")
    .order("date_debut", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getVoyageDetail(id: string) {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  const uid = auth.user?.id ?? null;
  // Fail-safe anon (cf. #61/#63) : sans session, les tables renvoient 42501 et
  // crashent le RSC. On retourne null ; le consommateur (VoyageDetail) fait notFound().
  if (!uid) return null;

  const [voyageRes, resRes, memRes, partRes, etapesRes] = await Promise.all([
    supabase.from("voyages").select("id, titre, destination, date_debut, date_fin, statut, owner_id, periode_texte, cover_photo_ref, cover_url, devise").eq("id", id).single(),
    supabase.from("reservations").select("id, type, fournisseur, reference, date_debut, date_fin, conciergerie_tel, conciergerie_mail, lien, notes, etablissement_id, details").eq("voyage_id", id).order("date_debut", { ascending: true, nullsFirst: false }),
    supabase.from("voyage_membres").select("profile_id, role, profile:profiles(display_name)").eq("voyage_id", id),
    // Lot B : qui part (participants) et quoi faire sur place (programme).
    supabase.from("voyage_participants")
      .select("id, profile_id, family_member_id, display_name, email, role").eq("voyage_id", id),
    supabase.from("voyage_etapes")
      .select("id, jour, heure, titre, lieu, etablissement_id, notes, ordre").eq("voyage_id", id),
  ]);
  if (voyageRes.error) throw voyageRes.error;
  if (resRes.error) throw resRes.error;
  if (memRes.error) throw memRes.error;
  if (partRes.error) throw partRes.error;
  if (etapesRes.error) throw etapesRes.error;

  const membres = (memRes.data ?? []).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { profile_id: m.profile_id, role: m.role, display_name: p?.display_name ?? null };
  });
  return {
    voyage: voyageRes.data,
    reservations: resRes.data ?? [],
    membres,
    participants: (partRes.data ?? []).map((p) => ({
      id: p.id,
      profileId: p.profile_id,
      familyMemberId: p.family_member_id,
      displayName: p.display_name,
      email: p.email,
      role: p.role === "organisateur" ? ("organisateur" as const) : ("voyageur" as const),
    })),
    etapes: (etapesRes.data ?? []).map((e) => ({
      id: e.id,
      jour: e.jour,
      // time renvoyé « HH:MM:SS » par PostgREST : le programme n'affiche que l'heure et la minute.
      heure: e.heure ? e.heure.slice(0, 5) : null,
      titre: e.titre,
      lieu: e.lieu,
      etablissementId: e.etablissement_id,
      notes: e.notes,
      ordre: e.ordre,
    })),
    isOwner: voyageRes.data.owner_id === uid,
  };
}

export async function getVoyageDocuments(voyageId: string) {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : sans session, voyage_documents renvoie 42501
  // (anon) et crashe le RSC ; on court-circuite.
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("voyage_documents")
    .select("id, nom, mime_type, taille, created_at, reservation_id")
    .eq("voyage_id", voyageId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getVoyageMeta(id: string): Promise<{ reservations: number; documents: number; voyageurs: number }> {
  const supabase = await createServerSupabase();
  const [r, d, m] = await Promise.all([
    supabase.from("reservations").select("id", { count: "exact", head: true }).eq("voyage_id", id),
    supabase.from("voyage_documents").select("id", { count: "exact", head: true }).eq("voyage_id", id),
    supabase.from("voyage_membres").select("profile_id", { count: "exact", head: true }).eq("voyage_id", id),
  ]);
  return { reservations: r.count ?? 0, documents: d.count ?? 0, voyageurs: m.count ?? 0 };
}

// ── Lot D : dépenses du voyage ──────────────────────────────────────────────

/**
 * Dépenses et remboursements d'un voyage. Requête à part plutôt qu'un
 * cinquième volet de `getVoyageDetail` : la fiche reste lisible, et une page
 * qui n'affiche pas les comptes n'a pas à les charger.
 */
export async function getDepensesVoyage(voyageId: string) {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63)
  const auth = await getCachedUser();
  if (!auth.user) return { depenses: [], remboursements: [] };
  const [depRes, remRes] = await Promise.all([
    supabase
      .from("voyage_depenses")
      .select("id, paye_par, libelle, montant_cents, date, mode, parts:voyage_depense_parts(participant_id, part_cents)")
      .eq("voyage_id", voyageId)
      .order("date", { ascending: false, nullsFirst: false }),
    supabase
      .from("voyage_remboursements")
      .select("id, de_participant_id, vers_participant_id, montant_cents, date")
      .eq("voyage_id", voyageId),
  ]);
  if (depRes.error) throw depRes.error;
  if (remRes.error) throw remRes.error;

  return {
    depenses: (depRes.data ?? []).map((d) => ({
      id: d.id,
      payePar: d.paye_par,
      libelle: d.libelle,
      // bigint côté base : PostgREST le renvoie en nombre, on s'en assure.
      montantCents: Number(d.montant_cents),
      date: d.date,
      mode: d.mode,
      parts: (d.parts ?? []).map((p) => ({
        participantId: p.participant_id,
        partCents: Number(p.part_cents),
      })),
    })),
    remboursements: (remRes.data ?? []).map((r) => ({
      id: r.id,
      deParticipantId: r.de_participant_id,
      versParticipantId: r.vers_participant_id,
      montantCents: Number(r.montant_cents),
      date: r.date,
    })),
  };
}

// ── Lot F : liens de partage ────────────────────────────────────────────────

/**
 * Les liens de partage d'un voyage. La RLS de `invitations` ne montre à chacun
 * que CEUX QU'IL A ÉMIS : un co-membre ne voit donc pas les liens du
 * propriétaire, et c'est voulu — un lien est un secret dont on reste le seul
 * gardien.
 */
export async function getLiensVoyage(voyageId: string) {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63)
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("invitations")
    .select("id, token, usages, usages_max, expire_le, created_at")
    .eq("voyage_id", voyageId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    token: i.token,
    usages: i.usages,
    usagesMax: i.usages_max,
    expireLe: i.expire_le,
    creeLe: i.created_at,
  }));
}
