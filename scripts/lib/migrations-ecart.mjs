// L'écart entre les migrations de `main` et celles réellement appliquées en
// production.
//
// Rien ne pousse les migrations automatiquement : une PR qui en contient une
// part en production AVANT sa table, et personne ne s'en aperçoit tant qu'une
// page ne casse pas. C'est arrivé deux fois en une semaine — le limiteur de
// débit sans sa table le 9 septembre, la fiche d'un proche sans sa colonne le
// 13. Ce module donne le chiffre ; l'alerte, elle, vit dans la CI.

/**
 * Ce que `main` a et que la prod n'a pas, dans l'ordre.
 *
 * L'inverse — ce que la prod a EN PLUS — est ignoré volontairement : des
 * migrations d'une branche non fusionnée (00061, 00062) ou retirées du dépôt
 * apparaissent ainsi, sans que ce soit un retard de déploiement. Un garde-fou
 * qui crie pour ça devient bruyant, donc ignoré.
 */
export function migrationsManquantes(migrations) {
  return migrations.filter((m) => m.local && !m.remote).map((m) => m.local);
}

/** Le message que lira quelqu'un qui n'a pas le contexte en tête. */
export function messageEcart(manquantes) {
  if (manquantes.length === 0) return "Production à jour : aucune migration en attente.";
  return [
    `${manquantes.length} migration(s) présentes dans main et ABSENTES de la production :`,
    ...manquantes.map((v) => `  • ${v}`),
    "",
    "L'application déployée peut déjà attendre ces tables ou ces colonnes.",
    "Pousser depuis un checkout à jour :  npx supabase db push",
  ].join("\n");
}
