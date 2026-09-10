import { env } from "@/lib/env";
import { ResendMailProvider } from "./resend";
import { MailpitMailProvider } from "./mailpit";
import { AucunMailProvider } from "./aucun";
import type { MailProvider } from "./types";

export function getMailProvider(): MailProvider {
  if (env.RESEND_API_KEY && env.MAIL_EXPEDITEUR) {
    return new ResendMailProvider(env.RESEND_API_KEY, env.MAIL_EXPEDITEUR);
  }
  // Transport local : seulement quand Resend n'est pas configuré, et jamais en
  // production (MAIL_MAILPIT_URL n'y est pas renseignée).
  if (env.MAIL_MAILPIT_URL && env.MAIL_EXPEDITEUR) {
    return new MailpitMailProvider(env.MAIL_MAILPIT_URL, env.MAIL_EXPEDITEUR);
  }
  return new AucunMailProvider();
}

export type { MailProvider, Message, MessageEnvoye } from "./types";
