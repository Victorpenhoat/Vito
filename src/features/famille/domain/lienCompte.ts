import type { Relation } from "./schemas";

/**
 * Mise en relation de deux comptes existants (code court + QR).
 *
 * Le code est lu à voix haute ou recopié à la main : son alphabet exclut tout
 * ce qui se confond (I/1, O/0, L, U). Trente caractères sur huit rangs ≈ 39
 * bits — c'est peu, d'où l'expiration courte, l'usage unique et le plafond de
 * tentatives côté base ; le code n'est pas un secret durable.
 */
export const ALPHABET_CODE = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Durée de vie du code : le temps de le montrer, pas celui de l'oublier. */
export const DUREE_CODE_MINUTES = 15;
const LONGUEUR_CODE = 8;

/**
 * Relation à proposer à l'autre côté du lien. Ce n'est qu'une suggestion : le
 * genre ne se devine pas (l'inverse de « fille » est père OU mère), donc on
 * propose le terme neutre et la personne tranche.
 */
export function relationInverse(relation: Relation): Relation | null {
  switch (relation) {
    case "conjoint":
    case "ami":
    case "autre":
      return relation;
    case "fille":
    case "fils":
    case "enfant":
      return "parent";
    case "pere":
    case "mere":
    case "parent":
      return "enfant";
    case "beau_parent":
      // le modèle n'a pas de « beau-fils / belle-fille » : ne pas mentir en
      // proposant « enfant », qui dirait autre chose.
      return "autre";
    case "moi":
      // « moi » désigne sa propre fiche : personne d'autre ne peut l'occuper.
      return null;
  }
}

export function genererCode(): string {
  const octets = new Uint8Array(LONGUEUR_CODE);
  crypto.getRandomValues(octets);
  // rejet du biais modulo : 256 n'est pas un multiple de 30, les valeurs hautes
  // sont retirées plutôt que repliées.
  const plafond = Math.floor(256 / ALPHABET_CODE.length) * ALPHABET_CODE.length;
  let code = "";
  for (let i = 0; code.length < LONGUEUR_CODE; i++) {
    if (i >= octets.length) {
      crypto.getRandomValues(octets);
      i = 0;
    }
    const octet = octets[i]!;
    if (octet >= plafond) continue;
    code += ALPHABET_CODE[octet % ALPHABET_CODE.length];
  }
  return code;
}

/** Saisie humaine → code canonique, ou null si ce n'en est pas un. */
export function normaliserCode(saisie: string): string | null {
  const code = saisie.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== LONGUEUR_CODE) return null;
  for (const c of code) if (!ALPHABET_CODE.includes(c)) return null;
  return code;
}

/** Affichage : deux groupes de quatre, plus faciles à dicter. */
export function formaterCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Reste à courir avant l'expiration du code. Une échéance illisible compte
 * comme expirée : mieux vaut proposer un code neuf que d'en montrer un mort.
 */
export function compteARebours(expireLe: string, maintenant: number): { expire: boolean; restant: string } {
  const fin = new Date(expireLe).getTime();
  const restant = Number.isNaN(fin) ? 0 : Math.max(0, Math.floor((fin - maintenant) / 1000));
  const mm = String(Math.floor(restant / 60)).padStart(2, "0");
  const ss = String(restant % 60).padStart(2, "0");
  return { expire: restant === 0, restant: `${mm}:${ss}` };
}
