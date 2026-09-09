import type { Depose } from "../domain/depose";

type Traduire = (cle: string, valeurs?: Record<string, string>) => string;

/**
 * Le « qui dépose », dit d'une seule façon partout : fiche, semaine, grille.
 *
 * Trois états, trois phrases — et « à définir » en est une : la question reste
 * ouverte, et l'écran doit la poser plutôt que de laisser un blanc.
 */
export function libelleDepose(depose: Depose, t: Traduire): string {
  if (depose.mode === "membre") return t("horaires.depose", { nom: depose.prenom });
  if (depose.mode === "covoiturage") return t("horaires.covoiturage");
  return t("horaires.deposeADefinir");
}
