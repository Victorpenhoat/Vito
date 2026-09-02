import { cache } from "react";
import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import { expiryStatus, monthsUntil } from "../domain/expiry";

export type Proche = {
  id: string;
  first_name: string;
  last_name: string;
  relation: string;
  circle: string;
  avatar_color: string | null;
  phone: string | null;
  doc_count: number;
  urgency: "expired" | "soon" | "valid" | null;
  urgency_months: number | null;
  urgency_doc_type: string | null;
};

export type DocMeta = {
  id: string;
  doc_type: string;
  doc_label: string | null;
  doc_number: string | null;
  country: string | null;
  holder_name: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issue_place: string | null;
  mime_type: string;
  reminder: boolean;
  has_verso: boolean;
};

export type ProcheDetail = {
  id: string;
  first_name: string;
  last_name: string;
  relation: string;
  circle: string;
  avatar_color: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  birth_place: string | null;
  address: string | null;
  address_inherit: boolean;
};

// pire statut d'expiration + mois restants si "soon" + type du doc fautif
// (expired > soon > valid > null) — le type alimente le badge « CNI expire bientôt »
function worstUrgency(
  docs: { expiry_date: string | null; doc_type: string }[],
  now: Date,
): { urgency: Proche["urgency"]; urgency_months: number | null; urgency_doc_type: string | null } {
  const rank = { expired: 3, soon: 2, valid: 1 } as const;
  let worst: Proche["urgency"] = null;
  let worstDocType: string | null = null;
  let soonMonths: number | null = null;
  for (const d of docs) {
    const s = expiryStatus(d.expiry_date, now);
    if (!s) continue;
    if (worst === null || rank[s] > rank[worst]) { worst = s; worstDocType = d.doc_type; }
    if (s === "soon" && d.expiry_date) {
      const m = monthsUntil(d.expiry_date, now);
      if (soonMonths === null || m < soonMonths) soonMonths = m;
    }
  }
  return {
    urgency: worst,
    urgency_months: worst === "soon" ? soonMonths : null,
    urgency_doc_type: worst === "expired" || worst === "soon" ? worstDocType : null,
  };
}

export const getProches = cache(async (): Promise<Proche[]> => {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, relation, circle, avatar_color, phone, family_documents(expiry_date, doc_type)")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (error) throw error;
  const now = new Date();
  const rows = (data ?? []).map((m) => {
    const docs = (m.family_documents ?? []) as { expiry_date: string | null; doc_type: string }[];
    return {
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      relation: m.relation,
      circle: m.circle,
      avatar_color: m.avatar_color,
      phone: m.phone,
      doc_count: docs.length,
      ...worstUrgency(docs, now),
    };
  });
  // « Moi » épinglé en tête (sort stable : l'ordre nom/prénom du SQL est conservé pour le reste)
  rows.sort((a, b) => (b.relation === "moi" ? 1 : 0) - (a.relation === "moi" ? 1 : 0));
  return rows;
});

export async function getProche(
  id: string,
): Promise<{ proche: ProcheDetail; documents: DocMeta[]; foyerAddress: string | null } | null> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return null;
  const { data: m, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, relation, circle, avatar_color, phone, email, birth_date, birth_place, address, address_inherit")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!m) return null;
  // jamais contenu_chiffre(_verso) hors route API — taille_verso suffit pour has_verso
  const { data: docs, error: dErr } = await supabase
    .from("family_documents")
    .select("id, doc_type, doc_label, doc_number, country, holder_name, issue_date, expiry_date, issue_place, mime_type, reminder, taille_verso")
    .eq("member_id", id)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (dErr) throw dErr;
  // adresse du foyer = adresse de la fiche « moi » (RLS scope déjà l'utilisateur)
  let foyerAddress: string | null = null;
  if (m.address_inherit) {
    const { data: moi, error: moiErr } = await supabase
      .from("family_members")
      .select("address")
      .eq("relation", "moi")
      .maybeSingle();
    if (moiErr) throw moiErr;
    foyerAddress = moi?.address ?? null;
  }
  return {
    proche: m as ProcheDetail,
    documents: (docs ?? []).map((d) => ({
      id: d.id,
      doc_type: d.doc_type,
      doc_label: d.doc_label,
      doc_number: d.doc_number,
      country: d.country,
      holder_name: d.holder_name,
      issue_date: d.issue_date,
      expiry_date: d.expiry_date,
      issue_place: d.issue_place,
      mime_type: d.mime_type,
      reminder: d.reminder,
      has_verso: d.taille_verso !== null,
    })),
    foyerAddress,
  };
}

export async function getMaFamille() {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  const uid = auth.user?.id ?? null;
  if (!uid) return null;
  // RLS (can_access_famille) : l'utilisateur a 0 ou 1 famille (unicité foyer).
  const { data: fam, error } = await supabase.from("familles").select("id, nom, owner_id").maybeSingle();
  if (error) throw error;
  if (!fam) return null;
  const { data: mems, error: mErr } = await supabase
    .from("famille_membres")
    .select("profile_id, role, profile:profiles(display_name)")
    .eq("famille_id", fam.id);
  if (mErr) throw mErr;
  const membres = (mems ?? []).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { profile_id: m.profile_id, role: m.role, display_name: p?.display_name ?? null };
  });
  return { famille: fam, membres, isOwner: fam.owner_id === uid };
}

export async function getFamilleRestos(familleId: string) {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : protégé en amont par getMaFamille (null → non
  // rendu), mais on garde par cohérence — sans session, la lecture renverrait 42501.
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("famille_restos")
    .select("etablissement_id, created_at, etablissement:etablissements(nom, ville)")
    .eq("famille_id", familleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
