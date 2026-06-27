import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { expiryStatus, monthsUntil } from "../domain/expiry";

export type Proche = {
  id: string;
  first_name: string;
  last_name: string;
  relation: string;
  circle: string;
  avatar_color: string | null;
  doc_count: number;
  urgency: "expired" | "soon" | "valid" | null;
  urgency_months: number | null;
};

export type DocMeta = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  country: string | null;
  holder_name: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  mime_type: string;
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
};

// pire statut d'expiration + mois restants si "soon" (expired > soon > valid > null)
function worstUrgency(dates: (string | null)[], now: Date): { urgency: Proche["urgency"]; urgency_months: number | null } {
  const rank = { expired: 3, soon: 2, valid: 1 } as const;
  let worst: Proche["urgency"] = null;
  let soonMonths: number | null = null;
  for (const d of dates) {
    const s = expiryStatus(d, now);
    if (!s) continue;
    if (worst === null || rank[s] > rank[worst]) worst = s;
    if (s === "soon" && d) {
      const m = monthsUntil(d, now);
      if (soonMonths === null || m < soonMonths) soonMonths = m;
    }
  }
  return { urgency: worst, urgency_months: worst === "soon" ? soonMonths : null };
}

export const getProches = cache(async (): Promise<Proche[]> => {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, relation, circle, avatar_color, family_documents(expiry_date)")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (error) throw error;
  const now = new Date();
  return (data ?? []).map((m) => {
    const docs = (m.family_documents ?? []) as { expiry_date: string | null }[];
    const { urgency, urgency_months } = worstUrgency(docs.map((d) => d.expiry_date), now);
    return {
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      relation: m.relation,
      circle: m.circle,
      avatar_color: m.avatar_color,
      doc_count: docs.length,
      urgency,
      urgency_months,
    };
  });
});

export async function getProche(id: string): Promise<{ proche: ProcheDetail; documents: DocMeta[] } | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: m, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, relation, circle, avatar_color, phone, email, birth_date")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!m) return null;
  const { data: docs, error: dErr } = await supabase
    .from("family_documents")
    .select("id, doc_type, doc_number, country, holder_name, issue_date, expiry_date, mime_type")
    .eq("member_id", id)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (dErr) throw dErr;
  return { proche: m as ProcheDetail, documents: (docs ?? []) as DocMeta[] };
}

export async function getMaFamille() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
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
  const { data, error } = await supabase
    .from("famille_restos")
    .select("etablissement_id, created_at, etablissement:etablissements(nom, ville)")
    .eq("famille_id", familleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
