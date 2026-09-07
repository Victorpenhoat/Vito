/**
 * Un identifiant d'app pour les Universal Links s'écrit
 * « <App ID Prefix>.<bundle ID> » — par exemple
 * « Q7UGNF4Q22.com.badakan.vito ». Le préfixe seul ne veut rien dire pour iOS.
 *
 * On vérifie la FORME, pas la vérité : personne ici ne peut savoir si ce
 * préfixe est le bon. Mais servir un fichier auquel il manque le bundle ID est
 * une erreur qu'on peut attraper — et qui se paie cher, iOS mettant en cache ce
 * qu'il télécharge.
 */
const FORME = /^[A-Z0-9]{10}\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export function appIdValide(valeur: string | undefined | null): valeur is string {
  return typeof valeur === "string" && FORME.test(valeur);
}
