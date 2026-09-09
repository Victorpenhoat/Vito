import { etatEcheance, type Paiement } from "./fiche";
import { etatValidite, joursAvant, JOURS_ALERTE } from "./protege";

// « 4 actions à traiter, triées par urgence ».
//
// Cet écran ne montre pas des données, il montre du TRAVAIL : ce qui est en
// retard, ce qui va l'être, et ce qui attendra. L'ordre y compte plus que le
// détail.

export type Urgence = "en_retard" | "proche" | "plus_tard";

export type Alerte = {
  cle: string;
  genre: "paiement" | "document";
  urgence: Urgence;
  activiteId: string;
  activiteNom: string;
  membres: string[];
  libelle: string;
  date: string | null;
  /** Pour un paiement seulement. */
  montantCents?: number;
  devise?: string;
  /** Pour un document qui expire bientôt : dans combien de jours. */
  jours?: number;
};

export type SourceAlertes = {
  activites: {
    id: string;
    nom: string;
    membres: { prenom: string }[];
    paiements: Paiement[];
    documents: { id: string; type: string; expireLe: string | null }[];
  }[];
};

const RANG: Record<Urgence, number> = { en_retard: 0, proche: 1, plus_tard: 2 };

/**
 * Tout ce qui demande une action, dans l'ordre de l'urgence.
 *
 * Le seuil est celui de la maquette : **30 jours**. Au-delà, ce n'est pas une
 * alerte, c'est une échéance — et l'écran la range dans « plus tard » plutôt
 * que de crier pour rien.
 *
 * Un document sans date d'expiration n'alerte jamais : un règlement intérieur
 * ne périme pas.
 */
export function construireAlertes(source: SourceAlertes, aujourdhui: string): Alerte[] {
  const alertes: Alerte[] = [];

  for (const a of source.activites) {
    const membres = a.membres.map((m) => m.prenom);

    for (const p of a.paiements) {
      const etat = etatEcheance(p, aujourdhui);
      if (etat === "paye") continue;
      const proche = p.echeance
        ? joursAvant(p.echeance, aujourdhui) <= JOURS_ALERTE
        : false;
      alertes.push({
        cle: `paiement:${p.id}`,
        genre: "paiement",
        urgence: etat === "en_retard" ? "en_retard" : proche ? "proche" : "plus_tard",
        activiteId: a.id,
        activiteNom: a.nom,
        membres,
        libelle: a.nom,
        date: p.echeance,
        montantCents: p.montantCents,
        devise: p.devise ?? "EUR",
      });
    }

    for (const d of a.documents) {
      const etat = etatValidite(d.expireLe, aujourdhui);
      // `valide` et `null` ne demandent rien : seuls l'expiré et le bientôt
      // expiré appellent une action.
      if (etat !== "expire" && etat !== "bientot") continue;
      alertes.push({
        cle: `document:${d.id}`,
        genre: "document",
        urgence: etat === "expire" ? "en_retard" : "proche",
        activiteId: a.id,
        activiteNom: a.nom,
        membres,
        libelle: d.type,
        date: d.expireLe,
        jours: etat === "bientot" ? joursAvant(d.expireLe!, aujourdhui) : 0,
      });
    }
  }

  return alertes.sort((x, y) => {
    const dr = RANG[x.urgence] - RANG[y.urgence];
    if (dr !== 0) return dr;
    // À urgence égale, la date la plus proche d'abord ; sans date, à la fin.
    if (!x.date) return 1;
    if (!y.date) return -1;
    return x.date.localeCompare(y.date);
  });
}

/**
 * Le verbe de l'action, pas un « Traiter » générique.
 *
 * L'écran des alertes est celui qu'on ouvre POUR AGIR : « Régler » et
 * « Renouveler » disent quoi faire, « Traiter » ne dit rien.
 */
export function verbeAlerte(alerte: Alerte): "regler" | "renouveler" | "ouvrir" {
  if (alerte.genre === "paiement") return "regler";
  // Un document expiré se renouvelle ; celui qui approche s'ouvre pour voir
  // s'il faut le refaire.
  return alerte.urgence === "en_retard" ? "renouveler" : "ouvrir";
}

/** Les trois sections de la maquette, dans l'ordre. Les vides sont omises. */
export function grouperAlertes(alertes: Alerte[]): { urgence: Urgence; alertes: Alerte[] }[] {
  return (["en_retard", "proche", "plus_tard"] as const)
    .map((urgence) => ({ urgence, alertes: alertes.filter((a) => a.urgence === urgence) }))
    .filter((g) => g.alertes.length > 0);
}

/**
 * Le compteur de la barre de navigation.
 *
 * Il ne compte QUE ce qui presse — retard et trente jours. Y ajouter « plus
 * tard » ferait une pastille perpétuellement allumée, qu'on cesserait de
 * regarder.
 */
export function nombreAlertesUrgentes(alertes: Alerte[]): number {
  return alertes.filter((a) => a.urgence !== "plus_tard").length;
}
