"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { env, EN_PRODUCTION } from "@/lib/env";
import { credentialsSchema, emailSchema } from "../domain/schemas";
import { envoyerLienMagiqueA } from "./lienMagique";

export async function signIn(_prev: unknown, formData: FormData) {
  const t = await getTranslations("auth.errors");
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: t("invalidCredentials") };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: t("signInFailed") };
  const locale = await getLocale();
  redirect({ href: "/accueil", locale });
}


export async function signOut() {
  const supabase = await createServerSupabase();
  // Scope local : on ne déconnecte que CET appareil. Fermer les autres est une
  // action distincte et explicite (Réglages > Appareils et sessions).
  await supabase.auth.signOut({ scope: "local" });
  const locale = await getLocale();
  redirect({ href: "/login", locale });
}

// ── Onboarding lot O-B : connexion sans mot de passe ────────────────────────

/**
 * Envoie un lien magique. Deux règles de sécurité, appliquées dans
 * `envoyerLienMagiqueA` (voir `./lienMagique.ts`) :
 * - l'inscription se fait UNIQUEMENT sur invitation (décision PO) ; le lien
 *   généré ne crée jamais de compte.
 * - la réponse est TOUJOURS la même, succès ou échec : elle ne doit jamais
 *   révéler si un compte existe pour cette adresse.
 */
export async function envoyerLienMagique(_prev: unknown, formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    const t = await getTranslations("auth.errors");
    return { error: t("emailInvalide") };
  }
  // L'origine du lien. EN PRODUCTION elle vient de la CONFIGURATION, jamais de
  // la requête : `Host` est fourni par l'appelant, et un `Host` empoisonné
  // enverrait le `token_hash` de la victime sur le domaine de l'attaquant —
  // c'est-à-dire sa session. Tant que GoTrue envoyait le message, il validait
  // cette valeur contre `SITE_URL` et sa liste de redirections ; depuis que nous
  // envoyons, plus personne ne la valide. Même parade que Stripe, qui construit
  // ses URL de retour depuis `NEXT_PUBLIC_APP_URL` pour la même raison.
  //
  // Hors production, l'origine de la requête reste la bonne : le port diffère
  // entre le développement (3000) et l'e2e (3001), et le lien doit revenir sur
  // l'instance qui l'a émis.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  // `NEXT_PUBLIC_APP_URL` est exigée en production par env.ts : le `??` n'est
  // qu'une ceinture, il ne se déclenche pas là où le `Host` est dangereux.
  const origine = (EN_PRODUCTION ? env.NEXT_PUBLIC_APP_URL : null) ?? `${proto}://${host}`;
  // Ne rend rien et ne jette rien : la réponse ci-dessous est la MÊME que le
  // compte existe ou non, et c'est ce qui empêche d'énumérer les comptes.
  await envoyerLienMagiqueA(parsed.data.email, origine);
  return { envoye: true as const, email: parsed.data.email };
}
