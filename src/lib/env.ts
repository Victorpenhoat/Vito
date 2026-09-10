import { z } from "zod";

const schema = z
  .object({
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
  });

const parsed = schema.safeParse({
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
});

if (!parsed.success) {
  // Message lisible (sinon Zod dump un objet JSON multi-lignes au cold-start / en CI)
  const details = parsed.error.issues
    .map((i) => `  ${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`)
    .join("\n");
  throw new Error(`Variables d'environnement invalides :\n${details}`);
}

export const env = parsed.data;
