// Boîte de réception (lot 2) : les adresses qu'un proche m'a recommandées.
//
// Le sens s'inverse par rapport à l'origine « recommandé par » saisie à la
// main : c'est celui qui recommande qui agit, et moi qui accepte ou décline.

export type Recommandation = {
  id: string;
  deProfileId: string;
  /** Nom de l'expéditeur, tel que mon carnet le connaît (ou son nom de compte). */
  deNom: string;
  categorie: "resto" | "hotel" | "vin";
  /** Adresse : l'identifiant du fournisseur. Null pour un vin, qui n'en a pas. */
  placeId: string | null;
  libelle: string;
  /** Vin : ce qu'il faut pour le retrouver dans une cave (nom, domaine, millésime). */
  vin: { nom: string; domaine: string | null; millesime: number | null } | null;
  mot: string | null;
  creeLe: string;
};

/** Les plus récentes d'abord ; à instant égal, l'ordre reçu est conservé. */
export function trierReception(boite: Recommandation[]): Recommandation[] {
  return [...boite].sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

/**
 * Cette adresse est-elle déjà dans mon carnet ? On le dit avant d'accepter.
 * Un vin n'a pas de place_id : la question ne se pose pas de la même façon, et
 * `find_or_create_vin` s'en charge de toute manière au moment d'accepter.
 */
export function dejaAuCarnet(reco: Recommandation, placeIdsDuCarnet: string[]): boolean {
  return reco.placeId != null && placeIdsDuCarnet.includes(reco.placeId);
}

/**
 * À qui puis-je recommander : les proches de mon Cercle AYANT un compte
 * rattaché. Les autres ne peuvent rien recevoir — c'est la règle du lot 1, et
 * la seule barrière anti-indésirables dont le produit ait besoin.
 */
export function destinatairesPossibles<T extends { nom: string; profileId: string | null }>(
  proches: T[],
): T[] {
  return proches
    .filter((p) => p.profileId != null)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
