// Qui dépose, en trois états — c'est le choix que montre la maquette.
//
// Le troisième compte autant que les deux autres : « à définir » n'est pas une
// donnée manquante, c'est une question ouverte qu'on veut voir. Et
// « covoiturage » dit que quelqu'un s'en charge, sans que ce soit nous.

export type Depose =
  | { mode: "membre"; prenom: string }
  | { mode: "covoiturage" }
  | { mode: "a_definir" };

/** Lit les deux colonnes d'un créneau en un seul état, sans ambiguïté. */
export function deposeDuCreneau(creneau: {
  deposePar?: { prenom: string } | null;
  covoiturage?: boolean | null;
}): Depose {
  if (creneau.deposePar) return { mode: "membre", prenom: creneau.deposePar.prenom };
  if (creneau.covoiturage) return { mode: "covoiturage" };
  return { mode: "a_definir" };
}

/**
 * La valeur postée par le formulaire, relue en colonnes.
 *
 * Le sélecteur n'a qu'un champ : « », « covoiturage », ou l'identifiant d'un
 * proche. Traduire ici plutôt que dans l'action garde la règle testable.
 */
export function colonnesDepose(valeur: string | undefined | null): {
  deposePar: string | null;
  covoiturage: boolean;
} {
  if (valeur === "covoiturage") return { deposePar: null, covoiturage: true };
  return { deposePar: valeur ? valeur : null, covoiturage: false };
}
