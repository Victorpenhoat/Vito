import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import { cleDedup } from "../domain/etiquette";
import type { VinCave } from "../domain/caveFilters";
import { moyenneVerres } from "../domain/verres";
import { lireAnalyse } from "../domain/analyse";

export async function getVinsCount(): Promise<number> {
  const supabase = await createServerSupabase();
  const { count } = await supabase.from("vins").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function getVinDetail(id: string) {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : sans session, les tables renvoient 42501 et
  // crashent le RSC. On retourne null ; le consommateur (VinDetail) fait notFound().
  const auth = await getCachedUser();
  if (!auth.user) return null;
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

/**
 * Vins déjà en cave, avec leur clé de dédoublonnage, leur nombre de dégustations
 * et le dernier lieu — alimente « Vous avez déjà bu ce vin N fois » à la capture.
 */
export async function getVinsConnus(): Promise<
  { id: string; cle: string; nb: number; dernier: string | null }[]
> {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("vins")
    .select("id, nom, domaine, millesime, degustations(deguste_le, lieu_nom, etablissement:etablissements(nom))");
  if (error) throw error;
  return (data ?? []).map((v) => {
    const degs = Array.isArray(v.degustations) ? v.degustations : [];
    const trie = [...degs].sort((a, b) => (b.deguste_le ?? "").localeCompare(a.deguste_le ?? ""));
    const last = trie[0];
    const etab = last ? (Array.isArray(last.etablissement) ? last.etablissement[0] : last.etablissement) : null;
    return {
      id: v.id,
      cle: cleDedup(v.nom, v.domaine, v.millesime),
      nb: degs.length,
      dernier: etab?.nom ?? last?.lieu_nom ?? null,
    };
  });
}

// ── Cave (Lot V-C) ──────────────────────────────────────────────────────────

/**
 * La cave : un vin par ligne, avec ce qu'on en sait D'EXPÉRIENCE (nombre de
 * dégustations, note moyenne, dernier lieu, envie de le retrouver).
 *
 * Le filtrage se fait ensuite en mémoire (`filtrerCave`) : la cave d'une
 * personne se compte en dizaines de bouteilles, et les facettes ont besoin de
 * l'ensemble pour être proposées — filtrer en SQL les ferait disparaître au fur
 * et à mesure des clics.
 */
export async function getCave(): Promise<VinCave[]> {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63)
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("vins")
    .select("id, nom, domaine, appellation, region, couleur, millesime, cepages, etiquette_chiffree, degustations(deguste_le, note, prix_paye, a_racheter, lieu_nom, etablissement:etablissements(nom))");
  if (error) throw error;

  return (data ?? []).map((v) => {
    const degs = Array.isArray(v.degustations) ? v.degustations : [];
    const trie = [...degs].sort((a, b) => (b.deguste_le ?? "").localeCompare(a.deguste_le ?? ""));
    const dernier = trie[0];
    const etab = dernier ? (Array.isArray(dernier.etablissement) ? dernier.etablissement[0] : dernier.etablissement) : null;
    const notes = degs.map((d) => (d.note == null ? null : Number(d.note)));
    const prix = degs.map((d) => (d.prix_paye == null ? null : Number(d.prix_paye))).filter((p): p is number => p != null);
    return {
      id: v.id,
      nom: v.nom,
      domaine: v.domaine,
      appellation: v.appellation,
      region: v.region,
      couleur: v.couleur,
      millesime: v.millesime,
      cepages: v.cepages ?? [],
      note_moyenne: moyenneVerres(notes),
      nb_degustations: degs.length,
      dernier_lieu: etab?.nom ?? dernier?.lieu_nom ?? null,
      derniere_date: dernier?.deguste_le ?? null,
      // « À retrouver » suit la DERNIÈRE dégustation : un vin racheté puis
      // décevant ne doit pas rester dans la liste à cause d'un avis d'il y a un an.
      a_retrouver: dernier?.a_racheter ?? false,
      a_etiquette: v.etiquette_chiffree != null,
      prix_max: prix.length ? Math.max(...prix) : null,
    };
  });
}

/** Fiche vin (design écran 4) : le vin, son analyse générée, et mes dégustations. */
export async function getVinFiche(id: string) {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return null;
  const [vinRes, degRes] = await Promise.all([
    supabase.from("vins").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("degustations")
      .select("id, deguste_le, note, prix_paye, prix_unite, commentaire, lieu_type, lieu_nom, a_racheter, etablissement:etablissements(id, nom), tags:degustation_tags(tag:tags(id, slug, label, color))")
      .eq("vin_id", id)
      .order("deguste_le", { ascending: false }),
  ]);
  if (vinRes.error) throw vinRes.error;
  if (degRes.error) throw degRes.error;
  if (!vinRes.data) return null;

  const degustations = (degRes.data ?? []).map((d) => {
    const etab = Array.isArray(d.etablissement) ? d.etablissement[0] : d.etablissement;
    const tags = (Array.isArray(d.tags) ? d.tags : [])
      .map((l) => (Array.isArray(l.tag) ? l.tag[0] : l.tag))
      .filter((tag): tag is { id: string; slug: string; label: string; color: string | null } => tag != null);
    return {
      id: d.id,
      deguste_le: d.deguste_le,
      note: d.note == null ? null : Number(d.note),
      prix_paye: d.prix_paye == null ? null : Number(d.prix_paye),
      prix_unite: d.prix_unite,
      commentaire: d.commentaire,
      lieu_type: d.lieu_type,
      lieu_nom: etab?.nom ?? d.lieu_nom ?? null,
      etablissement_id: etab?.id ?? null,
      a_racheter: d.a_racheter,
      tags,
    };
  });

  return {
    vin: vinRes.data,
    analyse: lireAnalyse(vinRes.data.analyse_contenu),
    degustations,
    noteMoyenne: moyenneVerres(degustations.map((d) => d.note)),
  };
}

// ── Vins bus ici (Lot V-D) ──────────────────────────────────────────────────

export type VinBuIci = {
  id: string;
  vinId: string;
  intitule: string;
  detail: string | null;
  note: number | null;
  prix: number | null;
  unite: string | null;
  degusteLe: string;
  /** Une dégustation peut exister SANS visite : on l'affiche, en le disant. */
  sansVisite: boolean;
};

/**
 * Les vins bus dans un établissement (design écran 8). Rien n'oblige une
 * dégustation à être rattachée à une visite : boire un verre au comptoir n'est
 * pas y avoir dîné.
 */
export async function getVinsBusIci(etablissementId: string): Promise<VinBuIci[]> {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : lecture parallèle au layout dans la fiche.
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("degustations")
    .select("id, deguste_le, note, prix_paye, prix_unite, visite_id, vin:vins(id, nom, domaine, cuvee, appellation, region, millesime, couleur)")
    .eq("etablissement_id", etablissementId)
    .order("deguste_le", { ascending: false });
  if (error) throw error;

  return (data ?? []).flatMap((d) => {
    const vin = Array.isArray(d.vin) ? d.vin[0] : d.vin;
    if (!vin) return [];
    return [{
      id: d.id,
      vinId: vin.id,
      intitule: [vin.domaine ?? vin.nom, vin.cuvee].filter(Boolean).join(" · "),
      detail: [vin.appellation ?? vin.region, vin.millesime].filter(Boolean).join(" ") || null,
      note: d.note == null ? null : Number(d.note),
      prix: d.prix_paye == null ? null : Number(d.prix_paye),
      unite: d.prix_unite,
      degusteLe: d.deguste_le,
      sansVisite: d.visite_id == null,
    }];
  });
}
