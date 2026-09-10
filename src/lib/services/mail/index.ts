import { env } from "@/lib/env";
import { ResendMailProvider } from "./resend";
import { AucunMailProvider } from "./aucun";
import type { MailProvider } from "./types";

export function getMailProvider(): MailProvider {
  if (env.RESEND_API_KEY && env.MAIL_EXPEDITEUR) {
    return new ResendMailProvider(env.RESEND_API_KEY, env.MAIL_EXPEDITEUR);
  }
  return new AucunMailProvider();
}

export type { MailProvider, Message, MessageEnvoye } from "./types";
