import type { LabelAnalyse } from "@/lib/services/vin-label/types";

// Lecture de l'analyse d'étiquette stockée en base (design Vins & Cave écran 4).
//
// ⚠ Ce contenu vient d'un MODÈLE et dort en jsonb : il peut être incomplet, mal
// typé, ou provenir d'une version antérieure du service. On ne fait donc jamais
// confiance à sa forme — tout est relu champ par champ, et ce qui n'est pas
// reconnu disparaît au lieu de casser la fiche.

export const AXES_PROFIL = ["corps", "tanins", "acidite", "sucre"] as const;
export type AxeProfil = (typeof AXES_PROFIL)[number];

/** Trois crans par axe : le design affiche un mot, pas un chiffre. */
export type Niveau = "bas" | "moyen" | "haut";

const estTexte = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const nombreOuNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const textesUniques = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter(estTexte).map((s) => s.trim()))] : [];

/** Relit l'analyse stockée. Renvoie null si rien d'exploitable n'en sort. */
export function lireAnalyse(brut: unknown): LabelAnalyse | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const profilBrut = (o.profil ?? {}) as Record<string, unknown>;
  const serviceBrut = (o.service ?? {}) as Record<string, unknown>;

  const analyse: LabelAnalyse = {
    profil: {
      corps: nombreOuNull(profilBrut.corps),
      tanins: nombreOuNull(profilBrut.tanins),
      acidite: nombreOuNull(profilBrut.acidite),
      sucre: nombreOuNull(profilBrut.sucre),
    },
    aromes: textesUniques(o.aromes),
    accords: textesUniques(o.accords),
    service: {
      temperature: estTexte(serviceBrut.temperature) ? serviceBrut.temperature : null,
      carafage: estTexte(serviceBrut.carafage) ? serviceBrut.carafage : null,
      garde: estTexte(serviceBrut.garde) ? serviceBrut.garde : null,
    },
    prixEstime: nombreOuNull(o.prixEstime),
    presentation: estTexte(o.presentation) ? o.presentation : null,
  };

  return estVide(analyse) ? null : analyse;
}

/** Une analyse dont il ne reste rien ne vaut pas la peine d'être affichée. */
function estVide(a: LabelAnalyse): boolean {
  const profilVide = AXES_PROFIL.every((axe) => a.profil[axe] == null);
  const serviceVide = !a.service.temperature && !a.service.carafage && !a.service.garde;
  return profilVide && serviceVide && a.aromes.length === 0 && a.accords.length === 0
    && a.prixEstime == null && !a.presentation;
}

/**
 * Cran affiché pour une jauge 0..5. Hors de cet intervalle, la valeur est
 * ignorée plutôt que ramenée de force : une jauge fausse vaut moins que pas de
 * jauge du tout, sur une fiche qui annonce déjà être générée.
 */
export function niveauProfil(valeur: number | null): Niveau | null {
  if (valeur == null || valeur < 0 || valeur > 5) return null;
  if (valeur <= 1.5) return "bas";
  if (valeur <= 3.5) return "moyen";
  return "haut";
}

/** Part de la jauge à remplir, pour la barre CSS (aucune lib de graphique ici). */
export function remplissageProfil(valeur: number | null): number {
  if (valeur == null || valeur < 0 || valeur > 5) return 0;
  return Math.round((valeur / 5) * 100);
}
