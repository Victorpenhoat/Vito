import "server-only";
import type { createServerSupabase } from "@/lib/supabase/server";

export type CibleJournal =
  | "code_activite" | "document_activite" | "document_famille" | "numero_document";

/**
 * Consigne un accès à une donnée protégée.
 *
 * On garde QUI, QUOI et QUAND — jamais la valeur révélée, jamais l'adresse IP :
 * un journal qui contiendrait le secret n'aurait fait que le déplacer.
 *
 * L'écriture ne peut pas faire échouer la révélation : l'utilisateur a fourni
 * son mot de passe, il a droit à sa donnée. Un journal indisponible est un
 * problème d'exploitation, pas une raison de lui refuser l'accès — on le trace
 * dans les logs serveur et on continue.
 */
export async function journaliser(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  cibleType: CibleJournal,
  cibleId: string,
  action: "revelation" | "ouverture",
): Promise<void> {
  const { error } = await supabase.from("journal_acces").insert({
    user_id: userId,
    cible_type: cibleType,
    cible_id: cibleId,
    action,
  });
  if (error) console.warn("journal_acces", error.message);
}
