import { createServerSupabase } from "@/lib/supabase/server";
import { filtersToQuery } from "../domain/filtersToQuery";
import type { VinFilters } from "../domain/schemas";
import type { Enums } from "@/types/database.types";

export type VinConsolide = {
  id: string;
  nom: string;
  domaine: string | null;
  millesime: number | null;
  region: string | null;
  couleur: string | null;
  achat_url: string | null;
  nb_degustations: number;
  derniere_date: string | null;
  derniere_note: number | null;
  dernier_etablissement_id: string | null;
};

export async function getMesVins(filters: VinFilters): Promise<VinConsolide[]> {
  const q = filtersToQuery(filters);
  const supabase = await createServerSupabase();

  // Récupère les vins (filtres intrinsèques) + leurs dégustations (filtres contextuels).
  let vinsQuery = supabase
    .from("vins")
    .select("id, nom, domaine, millesime, region, couleur, achat_url, degustations(deguste_le, note, etablissement_id)")
    .order("created_at", { ascending: false });
  if (q.vin.couleur) vinsQuery = vinsQuery.eq("couleur", q.vin.couleur as Enums<"vin_couleur">);
  if (q.vin.region) vinsQuery = vinsQuery.ilike("region", `%${q.vin.region}%`);

  const { data, error } = await vinsQuery;
  if (error) throw error;

  const rows = (data ?? []).map((v) => {
    const degs = (Array.isArray(v.degustations) ? v.degustations : []).filter((d) => {
      if (q.degustation.noteMin != null && (d.note ?? 0) < q.degustation.noteMin) return false;
      if (q.degustation.etablissementId && d.etablissement_id !== q.degustation.etablissementId) return false;
      if (q.degustation.dateFrom && (d.deguste_le ?? "") < q.degustation.dateFrom) return false;
      if (q.degustation.dateTo && (d.deguste_le ?? "") > q.degustation.dateTo) return false;
      return true;
    });
    const sorted = [...degs].sort((a, b) => (b.deguste_le ?? "").localeCompare(a.deguste_le ?? ""));
    const last = sorted[0];
    return {
      id: v.id, nom: v.nom, domaine: v.domaine, millesime: v.millesime, region: v.region,
      couleur: v.couleur, achat_url: v.achat_url,
      nb_degustations: degs.length,
      derniere_date: last?.deguste_le ?? null,
      derniere_note: last?.note ?? null,
      dernier_etablissement_id: last?.etablissement_id ?? null,
      _hasMatch: degs.length > 0,
    };
  });

  // Si des filtres de dégustation sont posés, ne garder que les vins ayant au moins une dégustation correspondante.
  const hasDegFilter = Boolean(
    q.degustation.noteMin != null || q.degustation.etablissementId || q.degustation.dateFrom || q.degustation.dateTo,
  );
  return rows
    .filter((r) => (hasDegFilter ? r._hasMatch : true))
    .map(({ _hasMatch, ...r }) => r);
}

export async function getVinsCount(): Promise<number> {
  const supabase = await createServerSupabase();
  const { count } = await supabase.from("vins").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function getVinDetail(id: string) {
  const supabase = await createServerSupabase();
  const [vinRes, degRes] = await Promise.all([
    supabase.from("vins").select("*").eq("id", id).single(),
    supabase
      .from("degustations")
      .select("id, deguste_le, note, prix_paye, commentaire, etablissement_id")
      .eq("vin_id", id)
      .order("deguste_le", { ascending: false }),
  ]);
  if (vinRes.error) throw vinRes.error;
  if (degRes.error) throw degRes.error;
  return { vin: vinRes.data, degustations: degRes.data ?? [] };
}
