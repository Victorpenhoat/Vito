import type { LabelFields } from "@/lib/services/vin-label/types";

// Domaine pur de la capture d'étiquette (design Vins & Cave écran 2).

/** Nom du vin dans la cave : la cuvée d'abord, sinon l'appellation. */
export function nomDepuisEtiquette(f: Pick<LabelFields, "cuvee" | "appellation" | "domaine">): string | null {
  const nom = f.cuvee?.trim() || f.appellation?.trim() || f.domaine?.trim() || "";
  return nom === "" ? null : nom;
}

/** Clé de dédoublonnage — même normalisation que l'index unique de la table
 *  (user_id, lower(nom), coalesce(millesime,0), lower(coalesce(domaine,''))). */
export function cleDedup(nom: string, domaine: string | null, millesime: number | null): string {
  return `${nom.trim().toLowerCase()}|${millesime ?? 0}|${(domaine ?? "").trim().toLowerCase()}`;
}

/** Un champ est à confirmer par l'utilisateur dès que le modèle doute. */
export function aConfirmer(niveau: string | undefined): boolean {
  return niveau === "a_verifier" || niveau === undefined;
}
