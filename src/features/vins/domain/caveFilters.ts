// Filtres de la Cave (design Vins & Cave écran 5) : sous-onglet + facettes
// couleur / région / cépage / note / prix, appliqués en mémoire sur les vins
// consolidés (même approche que filterPlaces côté adresses).

export type CaveOnglet = "tous" | "coups_de_coeur" | "a_retrouver" | "carte";
export const CAVE_ONGLETS: readonly CaveOnglet[] = ["tous", "coups_de_coeur", "a_retrouver", "carte"];

export type VinCave = {
  id: string;
  nom: string;
  domaine: string | null;
  appellation: string | null;
  region: string | null;
  couleur: string | null;
  millesime: number | null;
  cepages: string[];
  note_moyenne: number | null;
  nb_degustations: number;
  dernier_lieu: string | null;
  derniere_date: string | null;
  a_retrouver: boolean;
  a_etiquette: boolean;
  prix_max: number | null;
};

export type CaveFiltres = {
  onglet?: CaveOnglet;
  q?: string;
  couleur?: string | null;
  region?: string | null;
  cepage?: string | null;
  noteMin?: number | null;
  prixMax?: number | null;
};

/** Seuil « coup de cœur » (design : 4 verres et plus). */
export const SEUIL_COUP_DE_COEUR = 4;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Applique le sous-onglet puis les facettes ; l'ordre du tableau est préservé. */
export function filtrerCave(vins: VinCave[], f: CaveFiltres): VinCave[] {
  const q = f.q ? norm(f.q.trim()) : "";
  return vins.filter((v) => {
    if (f.onglet === "coups_de_coeur" && (v.note_moyenne ?? 0) < SEUIL_COUP_DE_COEUR) return false;
    if (f.onglet === "a_retrouver" && !v.a_retrouver) return false;
    if (f.couleur && v.couleur !== f.couleur) return false;
    if (f.region && norm(v.region ?? "") !== norm(f.region)) return false;
    if (f.cepage && !v.cepages.some((c) => norm(c) === norm(f.cepage!))) return false;
    if (f.noteMin != null && (v.note_moyenne ?? 0) < f.noteMin) return false;
    if (f.prixMax != null && v.prix_max != null && v.prix_max > f.prixMax) return false;
    if (q) {
      const foin = [v.nom, v.domaine ?? "", v.appellation ?? "", v.region ?? "", ...v.cepages].map(norm).join(" ");
      if (!foin.includes(q)) return false;
    }
    return true;
  });
}

/** Tri par dernière dégustation, la plus récente d'abord (design : « tri dernière dégustation »). */
export function trierParDerniereDegustation(vins: VinCave[]): VinCave[] {
  return [...vins].sort((a, b) => (b.derniere_date ?? "").localeCompare(a.derniere_date ?? ""));
}

/** Facettes disponibles, dédupliquées et triées, pour alimenter les menus. */
export function facettesCave(vins: VinCave[]): { couleurs: string[]; regions: string[]; cepages: string[] } {
  const couleurs = new Set<string>();
  const regions = new Set<string>();
  const cepages = new Set<string>();
  for (const v of vins) {
    if (v.couleur) couleurs.add(v.couleur);
    if (v.region) regions.add(v.region);
    for (const c of v.cepages) cepages.add(c);
  }
  const tri = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "fr"));
  return { couleurs: tri(couleurs), regions: tri(regions), cepages: tri(cepages) };
}
