import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailProvider } from "@/lib/services/mail";
import { log, errorContext } from "@/lib/log";
import type { TablesUpdate } from "@/types/database.types";

type Genre =
  | "lien_magique"
  | "invitation"
  | "rappel_activites"
  | "partage_voyage"
  | "depense";

export type Envoi = {
  a: string;
  genre: Genre;
  sujet: string;
  html: string;
  texte: string;
  /** Absent pour un destinataire sans compte (invitation). */
  userId?: string;
};

/**
 * Le point de passage unique de tout e-mail sortant de Vito.
 *
 * Trois règles, et elles se tiennent :
 *
 * 1. On journalise AVANT d'appeler le fournisseur, en `en_cours`. Une valeur
 *    optimiste ferait mentir le journal si le processus mourait pendant l'appel.
 * 2. On ne journalise ni le sujet ni le corps. Le genre suffit à savoir ce qui
 *    est parti ; un journal qui contiendrait le lien magique l'aurait déplacé.
 * 3. On ne jette JAMAIS. Un e-mail est un effet de bord : qu'il échoue ne doit
 *    pas faire échouer l'action qui l'a demandé — même raison que pour le
 *    journal des accès, où l'écriture ne peut pas faire échouer une révélation.
 */
export async function envoyer(p: Envoi): Promise<{ id: string } | null> {
  let ligneId: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("journal_envois")
      .insert({
        user_id: p.userId ?? null,
        destinataire: p.a,
        genre: p.genre,
        statut: "en_cours",
      })
      .select()
      .single();
    if (error || !data) {
      log.error("journal_envois_insert", { genre: p.genre, message: error?.message });
    } else {
      ligneId = data.id;
    }

    const envoye = await getMailProvider().envoyer({
      a: p.a,
      sujet: p.sujet,
      html: p.html,
      texte: p.texte,
    });

    await marquer(ligneId, envoye ? { statut: "accepte", fournisseur_id: envoye.id } : { statut: "echec", detail: "non parti" });
    return envoye;
  } catch (err) {
    log.error("mail_envoyer", { genre: p.genre, ...errorContext(err) });
    await marquer(ligneId, { statut: "echec", detail: "exception" }).catch(() => {});
    return null;
  }
}

async function marquer(ligneId: string | null, champs: TablesUpdate<"journal_envois">): Promise<void> {
  if (!ligneId) return;
  const admin = createAdminClient();
  const { error } = await admin.from("journal_envois").update(champs).eq("id", ligneId);
  if (error) log.error("journal_envois_update", { message: error.message });
}
