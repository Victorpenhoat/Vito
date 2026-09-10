import { log, errorContext } from "@/lib/log";
import type { MailProvider, Message, MessageEnvoye } from "./types";

// Transport LOCAL uniquement : dépose le message dans la boîte Mailpit que la
// pile Supabase fait déjà tourner, pour que l'e2e continue de lire un vrai
// message, d'en extraire le lien et de l'ouvrir. Rien de tout cela ne part sur
// le réseau.
export class MailpitMailProvider implements MailProvider {
  readonly name = "mailpit";

  constructor(
    private readonly base: string,
    private readonly expediteur: string,
  ) {}

  async envoyer(m: Message): Promise<MessageEnvoye | null> {
    try {
      const reponse = await fetch(`${this.base.replace(/\/$/, "")}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: this.expediteur },
          To: [{ Email: m.a }],
          Subject: m.sujet,
          Text: m.texte,
          HTML: m.html,
        }),
      });
      if (!reponse.ok) {
        log.warn("mail_local_refuse", { statut: reponse.status });
        return null;
      }
      const corps = (await reponse.json().catch(() => null)) as { ID?: unknown } | null;
      const id = typeof corps?.ID === "string" ? corps.ID : `mailpit-${Date.now()}`;
      return { id };
    } catch (err) {
      log.warn("mail_local_injoignable", errorContext(err));
      return null;
    }
  }
}
