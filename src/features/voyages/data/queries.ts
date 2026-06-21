import { createServerSupabase } from "@/lib/supabase/server";

export async function getMesVoyages() {
  const supabase = await createServerSupabase();
  // RLS (can_access_voyage) renvoie automatiquement les voyages possédés + partagés.
  const { data, error } = await supabase
    .from("voyages")
    .select("id, titre, destination, date_debut, date_fin, statut, owner_id")
    .order("date_debut", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getVoyageDetail(id: string) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  const [voyageRes, resRes, memRes] = await Promise.all([
    supabase.from("voyages").select("id, titre, destination, date_debut, date_fin, statut, owner_id").eq("id", id).single(),
    supabase.from("reservations").select("id, type, fournisseur, reference, date_debut, date_fin, conciergerie_tel, conciergerie_mail, lien, notes").eq("voyage_id", id).order("date_debut", { ascending: true, nullsFirst: false }),
    supabase.from("voyage_membres").select("profile_id, role, profile:profiles(display_name)").eq("voyage_id", id),
  ]);
  if (voyageRes.error) throw voyageRes.error;
  if (resRes.error) throw resRes.error;
  if (memRes.error) throw memRes.error;

  const membres = (memRes.data ?? []).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { profile_id: m.profile_id, role: m.role, display_name: p?.display_name ?? null };
  });
  return {
    voyage: voyageRes.data,
    reservations: resRes.data ?? [],
    membres,
    isOwner: voyageRes.data.owner_id === uid,
  };
}
