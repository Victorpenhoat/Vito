import Supercluster from "supercluster";

// Regroupement des marqueurs de la carte (design Hôtels v2 écran 5 « Dézoomé —
// marqueurs regroupés »). Les hôtels s'éparpillent sur plusieurs pays : sans
// regroupement, une carte dézoomée n'est qu'un tas d'épingles. Les restos, eux,
// tiennent dans une ville — leur config garde `clusters: false`.
//
// Tout passe par supercluster, dont l'index est PUR (aucun DOM) : le calcul se
// teste sans navigateur, et la carte n'a plus qu'à dessiner.

export type PointCarte = { id: string; lat: number; lng: number; ville: string | null };

/** Cadrage de la carte, tel que Leaflet le donne. */
export type Limites = { ouest: number; sud: number; est: number; nord: number };

export type Groupe = { cle: string; lat: number; lng: number; nb: number; ville: string | null };
export type Regroupement = { groupes: Groupe[]; isoles: string[] };

type Proprietes = { id: string; ville: string | null };

/**
 * Ville affichée sur une pastille : la plus représentée du groupe. À égalité,
 * l'ordre alphabétique tranche — sans cela, deux rendus du même groupe
 * pourraient afficher deux villes différentes.
 */
export function villeDominante(villes: (string | null)[]): string | null {
  const compte = new Map<string, number>();
  for (const v of villes) {
    if (!v) continue;
    compte.set(v, (compte.get(v) ?? 0) + 1);
  }
  const classe = [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  return classe[0]?.[0] ?? null;
}

/** Les points visibles dans le cadrage (bords inclus). */
export function dansLesLimites(points: PointCarte[], limites: Limites): string[] {
  return points
    .filter((p) => p.lat >= limites.sud && p.lat <= limites.nord && p.lng >= limites.ouest && p.lng <= limites.est)
    .map((p) => p.id);
}

/**
 * Prépare l'index une fois pour un jeu de points, puis répond à chaque cadrage.
 * L'index est conservé entre les appels : c'est lui qui sait, au clic sur une
 * pastille, jusqu'où zoomer pour la faire éclater.
 */
export function creerRegroupeur(points: PointCarte[]): {
  groupes: (limites: Limites, zoom: number) => Regroupement;
  zoomEclatement: (cle: string) => number | null;
} {
  // ⚠ Le rayon de supercluster s'exprime en pixels de tuiles 512 — deux fois
  // l'espace de Leaflet, qui affiche des tuiles 256. 80 ici = ~40 px à l'écran,
  // la distance en deçà de laquelle deux épingles se chevauchent visuellement.
  const index = new Supercluster<Proprietes>({ radius: 80, maxZoom: 16 });
  index.load(points.map((p) => ({
    type: "Feature" as const,
    properties: { id: p.id, ville: p.ville },
    geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
  })));

  return {
    groupes(limites, zoom) {
      const bruts = index.getClusters(
        [limites.ouest, limites.sud, limites.est, limites.nord],
        Math.round(zoom),
      );
      const groupes: Groupe[] = [];
      const isoles: string[] = [];

      for (const c of bruts) {
        const [lng, lat] = c.geometry.coordinates as [number, number];
        if ("cluster" in c.properties && c.properties.cluster) {
          const clusterId = c.properties.cluster_id;
          // getLeaves sur un carnet personnel : quelques dizaines de points,
          // pas de quoi ménager la machine.
          const feuilles = index.getLeaves(clusterId, Infinity);
          groupes.push({
            cle: `cluster-${clusterId}`,
            lat, lng,
            nb: c.properties.point_count,
            ville: villeDominante(feuilles.map((f) => f.properties.ville)),
          });
        } else {
          isoles.push(c.properties.id);
        }
      }
      return { groupes, isoles };
    },

    zoomEclatement(cle) {
      const clusterId = Number(cle.replace("cluster-", ""));
      if (!Number.isFinite(clusterId)) return null;
      try {
        return index.getClusterExpansionZoom(clusterId);
      } catch {
        // Pastille d'un cadrage périmé (la carte a bougé entre le rendu et le
        // clic) : mieux vaut ne pas zoomer que planter la carte.
        return null;
      }
    },
  };
}
