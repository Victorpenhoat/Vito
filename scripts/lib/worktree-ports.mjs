// Une pile Supabase locale par worktree : le calcul des ports et le patch de
// configuration, isolés du script pour être éprouvables.
//
// Pourquoi : `supabase db reset` rejoue les migrations du disque de CELUI qui
// lance la commande. Deux worktrees sur une seule pile, et le reset de l'un
// efface la migration en cours d'écriture de l'autre — quatre fois en deux
// heures le 2026-09-12, dont deux par des commandes de courtoisie. Le partage
// implicite rend la discipline insuffisante ; il faut séparer les piles.

/** Huit worktrees simultanés : au-delà, autant se poser la question autrement. */
export const DECALAGES_MAX = 8;

/**
 * Décalage de ports d'un worktree, dérivé de son nom : le même worktree
 * retrouve toujours sa pile, sans registre à tenir ni fichier d'état à
 * synchroniser. Jamais zéro — ce serait la pile principale.
 *
 * `occupes` permet de céder la place quand deux noms tombent sur la même
 * centaine : on avance jusqu'à la première libre plutôt que de rendre un port
 * déjà pris, qui ferait échouer le démarrage sans dire pourquoi.
 */
export function decalagePour(nom, occupes = []) {
  let hash = 0;
  for (let i = 0; i < nom.length; i++) hash = (hash * 31 + nom.charCodeAt(i)) | 0;
  const depart = Math.abs(hash) % DECALAGES_MAX;
  for (let i = 0; i < DECALAGES_MAX; i++) {
    const decalage = 100 * (((depart + i) % DECALAGES_MAX) + 1);
    if (!occupes.includes(decalage)) return decalage;
  }
  throw new Error(`Aucun décalage de ports libre (${DECALAGES_MAX} piles déjà déclarées).`);
}

/**
 * La configuration de la pile déportée : un identifiant de projet à elle (sans
 * quoi les conteneurs Docker se marchent dessus) et TOUS ses ports décalés.
 *
 * Tous, sans exception : le spike du 2026-09-12 a montré qu'un sixième port
 * traîne loin dans le fichier (54327, l'analytique du stockage). Oublié, il
 * fait échouer le démarrage de la seconde pile — d'où le remplacement par
 * motif plutôt que champ par champ.
 */
export function configPatchee(texte, { projectId, decalage }) {
  return texte
    .replace(/^project_id = ".*"$/m, `project_id = "${projectId}"`)
    .replace(/\b543(\d\d)\b/g, (_, fin) => String(54300 + decalage + Number(fin)));
}

/** Les ports de la pile par défaut, tels qu'ils sont écrits dans .env.local. */
const PORTS_ENV = { NEXT_PUBLIC_SUPABASE_URL: 54321, MAIL_MAILPIT_URL: 54324 };

/**
 * Le .env.local du worktree : l'app et Mailpit visent la pile locale, et
 * Playwright son propre serveur.
 *
 * Recalculé depuis les ports de RÉFÉRENCE et non depuis ce que contient le
 * fichier : rejouer le script doit rendre exactement le même résultat, et un
 * changement de décalage doit être suivi. Le premier jet dérivait du fichier
 * courant, si bien qu'un second passage laissait l'URL sur l'ancienne pile —
 * en silence, puisque cette pile répondait encore.
 *
 * Les clés ne sont pas touchées : elles dérivent du secret JWT, identique
 * d'une pile à l'autre.
 */
export function envPatche(texte, { decalage }) {
  let sortie = texte;
  for (const [cle, base] of Object.entries(PORTS_ENV)) {
    sortie = sortie.replace(
      new RegExp(`^${cle}=(.*?):\\d{4,5}\\s*$`, "m"),
      `${cle}=$1:${base + decalage}`,
    );
  }
  const portE2e = 3001 + decalage / 100;
  return /^E2E_PORT=/m.test(sortie)
    ? sortie.replace(/^E2E_PORT=.*$/m, `E2E_PORT=${portE2e}`)
    : `${sortie.trimEnd()}\nE2E_PORT=${portE2e}\n`;
}
