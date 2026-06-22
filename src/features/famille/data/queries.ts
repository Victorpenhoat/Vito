import { createServerSupabase } from "@/lib/supabase/server";

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
