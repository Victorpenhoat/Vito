// L'écart entre la configuration d'auth déclarée dans `supabase/config.toml` et
// celle réellement appliquée sur un projet distant.
//
// Pourquoi ce garde-fou existe. Le 14 septembre 2026, on a découvert que le hook
// `custom_access_token` était DÉSACTIVÉ en production ET en staging — vraisemblablement
// depuis toujours. Or `is_agence()`, `is_concierge()` et `is_admin()` lisent tous le
// claim `user_role` que ce hook est seul à poser : sans lui, les trois rendent `false`
// pour tout le monde, et aucun compte agence ni admin ne disposait de ses droits en
// production.
//
// Aucun test ne pouvait l'attraper. Le filet RLS (251 assertions) éprouve le CODE ;
// là, c'était la CONFIGURATION qui manquait, et elle ne vit pas dans le dépôt. On ne
// l'a trouvé qu'en comparant explicitement le local au distant.
//
// Ce module donne la liste des dérives ; l'alerte, elle, vit dans la CI.

/**
 * Les chemins de configuration qui DOIVENT correspondre entre le dépôt et le distant.
 *
 * Volontairement court. Le config local est un config de DÉVELOPPEMENT : il diffère
 * légitimement du distant sur des dizaines de réglages (URL du site, longueur des OTP,
 * modèles d'e-mail en français, Twilio éteint…). Mesuré : 13 écarts en prod, tous
 * normaux. Un garde-fou qui crierait sur `--exit-code` nu serait rouge en permanence,
 * donc ignoré en une semaine — la panne qu'on veut éviter, pas celle qu'on veut créer.
 *
 * N'ajouter ici qu'un réglage dont un écart est une PANNE, jamais un goût.
 */
export const CHEMINS_SURVEILLES = [
  "auth.hook.custom_access_token.enabled",
  "auth.hook.custom_access_token.uri",
];

/**
 * Le JSON de `supabase config diff`, extrait d'une sortie qui n'en est pas que.
 *
 * Le CLI écrit avant lui un WARN de dépréciation et une ligne « Comparing against
 * project … ». Lève plutôt que de rendre un diff vide si rien ne se parse : « je n'ai
 * pas pu demander » déguisé en « tout va bien » est exactement le mode de panne qui a
 * laissé le hook débranché des mois durant.
 */
export function extraireDiff(sortie) {
  const lignes = String(sortie).split("\n");
  for (let i = lignes.length - 1; i >= 0; i--) {
    const ligne = lignes[i].trim();
    if (!ligne.startsWith("{")) continue;
    try {
      return JSON.parse(ligne);
    } catch {
      // ligne non parsable : on continue de remonter
    }
  }
  throw new Error(
    `La sortie de \`supabase config diff\` ne contient pas de JSON exploitable :\n${sortie}`,
  );
}

/**
 * Vrai quand la CLI a rendu son AIDE au lieu d'exécuter — le signe qu'elle ne
 * connaît pas `config diff`.
 *
 * Mesuré : la CLI 2.116.0 ne connaît que `config push`. Elle ne dit pas « commande
 * inconnue » : elle rend son aide en JSON avec un statut non nul, ce qui est
 * indiscernable d'un problème de jeton si on ne regarde pas la forme. Sans cette
 * détection, le message d'erreur envoie chercher un secret qui ne manque pas.
 */
export function estSousCommandeInconnue(sortie) {
  const t = String(sortie);
  return t.includes('"_tag":"Help"') && t.includes("supabase config");
}

/** Les dérives qui comptent, dans l'ordre où elles sont déclarées ci-dessus. */
export function derivesInterdites(diff, chemins = CHEMINS_SURVEILLES) {
  const changes = diff?.changes ?? [];
  const parChemin = new Map(changes.map((c) => [(c.path ?? []).join("."), c]));
  return chemins
    .filter((chemin) => parChemin.has(chemin))
    .map((chemin) => {
      const c = parChemin.get(chemin);
      return { chemin, local: c.local, distant: c.remote };
    });
}

/** Le message que lira quelqu'un qui n'a pas le contexte en tête. */
export function messageDerive(derives, cible) {
  if (derives.length === 0) {
    return `Configuration d'auth conforme sur ${cible} : aucun réglage surveillé ne dérive.`;
  }
  return [
    `${derives.length} réglage(s) d'auth surveillés DIVERGENT entre le dépôt et ${cible} :`,
    ...derives.map((d) => `  • ${d.chemin}\n      dépôt : ${JSON.stringify(d.local)}\n      ${cible} : ${JSON.stringify(d.distant)}`),
    "",
    "Le hook custom_access_token pose le claim `user_role`. Sans lui, is_agence(),",
    "is_concierge() et is_admin() rendent false pour TOUT LE MONDE : les comptes",
    "agence et admin perdent leurs droits, en silence et sans qu'aucun test rougisse.",
    "",
    "Réparer depuis le tableau de bord : Authentication → Hooks → Custom Access Token,",
    "type « Postgres function », schema `public`, fonction `custom_access_token_hook`.",
    "",
    "NE JAMAIS réparer ça par `supabase config push` : le push envoie TOUT le",
    "config.toml et écraserait le Site URL de production par http://127.0.0.1:3000,",
    "remettrait les modèles d'e-mail en anglais et désactiverait Twilio.",
  ].join("\n");
}
