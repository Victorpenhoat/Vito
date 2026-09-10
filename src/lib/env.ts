import { z } from "zod";

/** Une variable absente et une variable vide sont la même chose. Sans ceci, la
 *  CI qui écrit `MAIL_MAILPIT_URL=` (clé de statut disparue en amont) ferait
 *  échouer `.url()` — et donc l'import de ce module, donc TOUS les jobs, avec
 *  un message qui ne parle pas d'e-mails. */
const vide = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), inner);

export const schema = z
  .object({
    // Le discriminant de production, et pourquoi ce n'est PAS `NODE_ENV` :
    // `next build` met `NODE_ENV` à "production" partout — y compris en CI et
    // pour l'e2e local, qui construisent puis démarrent l'app sans jamais devoir
    // envoyer un message. Une garde branchée sur `NODE_ENV` casserait la CI au
    // lieu de protéger la production. `VERCEL_ENV` vaut "production" pour le
    // seul déploiement de production ; absent en local, "preview" en préversion.
    // Renseignée par Vercel, jamais par nous.
    VERCEL_ENV: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    GOOGLE_PLACES_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    MERCHANT_PARTNER_URL: z.string().url().optional(),
    // Taux de change des dépenses de voyage (Frankfurter, taux BCE, sans clé).
    // Absent : aucun taux n'est proposé, il se saisit à la main.
    TAUX_CHANGE_URL: z.string().url().optional(),
    // Universal Links iOS : « <TeamID>.<bundleId> ». Absent : le fichier
    // apple-app-site-association n'est pas servi.
    APPLE_APP_ID: z.string().optional(),
    // Adresse affichée sur la page publique /confidentialite (exigée par Apple).
    CONTACT_EMAIL: z.string().email().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_MONTHLY: z.string().optional(),
    STRIPE_PRICE_YEARLY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    DOCUMENTS_ENCRYPTION_KEY: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    // Envoi d'e-mails (lot 1 « mails »). Absentes : rien ne part, et le journal
    // le dit — c'est l'état du développement local et de la CI.
    RESEND_API_KEY: z.string().optional(),
    RESEND_WEBHOOK_SECRET: z.string().optional(),
    MAIL_EXPEDITEUR: z.string().email().optional(),
    // Transport local (dev/CI) : dépose dans la boîte Mailpit de la pile
    // Supabase. Ignorée dès que RESEND_API_KEY est présente, et absente en
    // production — impossible d'y envoyer un vrai message par ce biais.
    MAIL_MAILPIT_URL: vide(z.string().url().optional()),
  })
  .refine(
    (v) =>
      !v.STRIPE_SECRET_KEY ||
      (v.STRIPE_WEBHOOK_SECRET &&
        v.STRIPE_PRICE_MONTHLY &&
        v.STRIPE_PRICE_YEARLY &&
        v.NEXT_PUBLIC_APP_URL &&
        v.SUPABASE_SERVICE_ROLE_KEY),
    { message: "STRIPE_SECRET_KEY présent : STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, NEXT_PUBLIC_APP_URL et SUPABASE_SERVICE_ROLE_KEY sont requis" }
  )
  .refine((v) => !v.RESEND_API_KEY || (v.RESEND_WEBHOOK_SECRET && v.MAIL_EXPEDITEUR), {
    message:
      "RESEND_API_KEY présent : RESEND_WEBHOOK_SECRET et MAIL_EXPEDITEUR sont requis — " +
      "une configuration à moitié faite produit les pannes qu'on ne comprend pas",
  })
  // En PRODUCTION, l'envoi n'est plus optionnel, et le refus doit être bruyant.
  // Sans ces variables, aucun fournisseur n'est configuré : `envoyer()` écrit
  // `echec`, le lien magique n'est pas envoyé, et l'action de connexion répond
  // quand même « regardez votre boîte » — parce que sa réponse est TOUJOURS la
  // même, règle de non-énumération qu'on ne va pas défaire. Autrement dit, un
  // déploiement mal configuré enferme tout le monde dehors en silence, avec pour
  // seule trace une ligne de log. Mieux vaut ne pas démarrer.
  //
  // NEXT_PUBLIC_APP_URL est du même lot : en production l'origine du lien magique
  // vient de la configuration et jamais de l'en-tête `Host` (cf. actions.ts), ce
  // qui suppose qu'elle existe.
  .refine(
    (v) =>
      v.VERCEL_ENV !== "production" ||
      (v.RESEND_API_KEY && v.RESEND_WEBHOOK_SECRET && v.MAIL_EXPEDITEUR && v.NEXT_PUBLIC_APP_URL),
    {
      message:
        "En production, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, MAIL_EXPEDITEUR et " +
        "NEXT_PUBLIC_APP_URL sont requis — sans eux le lien magique ne part pas, " +
        "et personne ne le voit : la réponse de connexion est la même dans tous les cas",
    },
  );

const parsed = schema.safeParse({
  VERCEL_ENV: process.env.VERCEL_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  MERCHANT_PARTNER_URL: process.env.MERCHANT_PARTNER_URL,
  TAUX_CHANGE_URL: process.env.TAUX_CHANGE_URL,
  APPLE_APP_ID: process.env.APPLE_APP_ID,
  CONTACT_EMAIL: process.env.CONTACT_EMAIL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
  STRIPE_PRICE_YEARLY: process.env.STRIPE_PRICE_YEARLY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DOCUMENTS_ENCRYPTION_KEY: process.env.DOCUMENTS_ENCRYPTION_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
  MAIL_EXPEDITEUR: process.env.MAIL_EXPEDITEUR,
  MAIL_MAILPIT_URL: process.env.MAIL_MAILPIT_URL,
});

if (!parsed.success) {
  // Message lisible (sinon Zod dump un objet JSON multi-lignes au cold-start / en CI)
  const details = parsed.error.issues
    .map((i) => `  ${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`)
    .join("\n");
  throw new Error(`Variables d'environnement invalides :\n${details}`);
}

export const env = parsed.data;

/** Vrai pour le seul déploiement de production (cf. `VERCEL_ENV` ci-dessus). */
export const EN_PRODUCTION = env.VERCEL_ENV === "production";
