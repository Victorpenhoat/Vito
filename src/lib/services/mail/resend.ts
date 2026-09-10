import { log, errorContext } from "@/lib/log";
import type { MailProvider, Message, MessageEnvoye } from "./types";

// Resend en `fetch`, sans SDK : le dépôt fait déjà ainsi pour Frankfurter, et
// une dépendance de plus est une dépendance à tenir à jour et à auditer.
export class ResendMailProvider implements MailProvider {
  readonly name = "resend";

  constructor(
    private readonly cle: string,
    private readonly expediteur: string,
  ) {}

  async envoyer(m: Message): Promise<MessageEnvoye | null> {
    try {
      const reponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cle}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.expediteur,
          to: m.a,
          subject: m.sujet,
          html: m.html,
          text: m.texte,
        }),
      });
      const corps: unknown = await reponse.json().catch(() => null);
      if (!reponse.ok) {
        log.warn("mail_refuse", { fournisseur: this.name, detail: detailDe(corps) });
        return null;
      }
      const id = (corps as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || id.length === 0) {
        log.warn("mail_sans_identifiant", { fournisseur: this.name });
        return null;
      }
      return { id };
    } catch (err) {
      log.warn("mail_injoignable", { fournisseur: this.name, ...errorContext(err) });
      return null;
    }
  }
}

function detailDe(corps: unknown): string {
  const message = (corps as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message.slice(0, 200) : "refus sans détail";
}
