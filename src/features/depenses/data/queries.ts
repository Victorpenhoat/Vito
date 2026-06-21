import { createServerSupabase } from "@/lib/supabase/server";
import { computeBalances, simplifyDebts, type Part } from "../domain/calculations";

export async function getMesGroupes() {
  const supabase = await createServerSupabase();
  // RLS (can_access_groupe) renvoie automatiquement les groupes possédés + partagés.
  const { data, error } = await supabase
    .from("depense_groupes")
    .select("id, titre, devise, voyage_id, owner_id")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getGroupeDetail(id: string) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  const [gRes, mRes, dRes, rRes] = await Promise.all([
    supabase.from("depense_groupes").select("id, titre, devise, voyage_id, owner_id").eq("id", id).single(),
    supabase.from("depense_groupe_membres").select("profile_id, role, profile:profiles(display_name)").eq("groupe_id", id),
    supabase.from("depenses").select("id, paye_par, libelle, montant_cents, date, mode").eq("groupe_id", id).order("date", { ascending: true, nullsFirst: false }),
    supabase.from("remboursements").select("id, de_profile_id, vers_profile_id, montant_cents, date").eq("groupe_id", id).order("date", { ascending: true, nullsFirst: false }),
  ]);
  if (gRes.error) throw gRes.error;
  if (mRes.error) throw mRes.error;
  if (dRes.error) throw dRes.error;
  if (rRes.error) throw rRes.error;

  const depenseIds = (dRes.data ?? []).map((d) => d.id);
  let parts: { depense_id: string; profile_id: string; part_cents: number }[] = [];
  if (depenseIds.length) {
    const partsRes = await supabase.from("depense_parts").select("depense_id, profile_id, part_cents").in("depense_id", depenseIds);
    if (partsRes.error) throw partsRes.error;
    parts = partsRes.data ?? [];
  }

  const partsByDepense = new Map<string, Part[]>();
  for (const p of parts) {
    const arr = partsByDepense.get(p.depense_id) ?? [];
    arr.push({ profileId: p.profile_id, partCents: p.part_cents });
    partsByDepense.set(p.depense_id, arr);
  }

  const membres = (mRes.data ?? []).map((m) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return { profile_id: m.profile_id, role: m.role, display_name: p?.display_name ?? null };
  });
  const depenses = (dRes.data ?? []).map((d) => ({ ...d, parts: partsByDepense.get(d.id) ?? [] }));

  const memberIds = membres.map((m) => m.profile_id);
  const soldes = computeBalances(
    memberIds,
    depenses.map((d) => ({ payePar: d.paye_par, parts: d.parts })),
    (rRes.data ?? []).map((r) => ({ deProfileId: r.de_profile_id, versProfileId: r.vers_profile_id, montantCents: r.montant_cents })),
  );
  const transferts = simplifyDebts(soldes);

  return {
    groupe: gRes.data,
    membres,
    depenses,
    remboursements: rRes.data ?? [],
    soldes,
    transferts,
    isOwner: gRes.data.owner_id === uid,
  };
}
