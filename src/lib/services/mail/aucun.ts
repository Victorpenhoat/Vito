import { log } from "@/lib/log";
import type { MailProvider, Message } from "./types";

// Aucun fournisseur configuré — l'état du développement local et de la CI, où
// AUCUN message ne doit sortir. On ne fait pas semblant d'avoir envoyé : le
// journal en gardera une ligne `echec`, ce qui est la vérité.
export class AucunMailProvider implements MailProvider {
  readonly name = "aucun";
  async envoyer(m: Message): Promise<null> {
    log.info("mail_non_configure", { a: m.a, sujet: m.sujet });
    return null;
  }
}
