import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { log } from "@/lib/log";

// Limitation de débit. Ce qu'on protège n'est pas la base — la RLS s'en charge —
// mais l'argent et les tiers : Google Places à chaque recherche d'adresse,
// Anthropic à chaque lecture de pièce ou d'étiquette. Le compteur vit en base
// (cf. migration 00060) parce qu'il doit être partagé par toutes les instances
// serverless : un compteur en mémoire se remet à zéro à chaque démarrage à
// froid, c'est-à-dire à peu près à chaque appel.

/** Barèmes, en un seul endroit : le navigateur n'a jamais son mot à dire. */
export const BAREMES = {
  // Recherche d'adresse : la saisie est déjà débruitée côté client, donc une
  // frappe normale n'en produit qu'une poignée. 40/min laisse vivre une
  // recherche hésitante et arrête une boucle.
  recherche_lieu: { limite: 40, fenetreSecondes: 60 },
  // Vignettes : une grille de résultats en demande une par carte, et la page
  // peut se recharger. Large exprès — c'est un garde-fou, pas une jauge.
  photo_lieu: { limite: 300, fenetreSecondes: 60 },
  // Lectures facturées à l'appel et lentes : une pièce d'identité ou une
  // étiquette se photographie une fois, on se reprend quelques fois.
  lecture_document: { limite: 12, fenetreSecondes: 60 },
  lecture_etiquette: { limite: 12, fenetreSecondes: 60 },
  // Ajout d'adresse au carnet : chaque ajout appelle le fournisseur pour les
  // détails du lieu.
  ajout_lieu: { limite: 30, fenetreSecondes: 60 },
} as const;

export type Action = keyof typeof BAREMES;

/**
 * Consomme un jeton pour cette action et ce compte.
 *
 * Rend `true` si l'appel est permis. **Refuse en cas d'erreur** : un limiteur
 * qui s'ouvre quand la base tousse n'en est pas un. Le coût de cette rigueur
 * est nul ici — toutes les actions limitées ont besoin de la base juste après,
 * elles auraient échoué de toute façon.
 */
export async function consommerQuota(
  supabase: SupabaseClient<Database>,
  action: Action,
): Promise<boolean> {
  const { limite, fenetreSecondes } = BAREMES[action];
  const { data, error } = await supabase.rpc("consommer_quota", {
    p_action: action,
    p_limite: limite,
    p_fenetre_secondes: fenetreSecondes,
  });
  if (error) {
    // Jamais l'identité ni la valeur du compteur : le journal dit qu'un
    // garde-fou a failli, pas qui passait devant.
    log.error("quota_indisponible", { action, message: error.message });
    return false;
  }
  return data === true;
}
