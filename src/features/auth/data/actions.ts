"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { credentialsSchema, emailSchema } from "../domain/schemas";

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
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/login", locale });
}

// ── Onboarding lot O-B : connexion sans mot de passe ────────────────────────

/**
 * Envoie un lien magique. Deux règles de sécurité :
 * - `shouldCreateUser: false` — l'inscription se fait UNIQUEMENT sur invitation
 *   (décision PO) ; sans cela, ce formulaire créerait des comptes.
 * - la réponse est TOUJOURS la même, succès ou échec : elle ne doit jamais
 *   révéler si un compte existe pour cette adresse (contrainte du brief).
 */
export async function envoyerLienMagique(_prev: unknown, formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    const t = await getTranslations("auth.errors");
    return { error: t("emailInvalide") };
  }
  const supabase = await createServerSupabase();
  // L'origine réelle (le port diffère entre dev, e2e et prod) — le lien doit
  // revenir sur la même instance.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${proto}://${host}/api/auth/confirm` },
  });
  // Erreur volontairement avalée (compte inconnu, quota…) : on la trace, on ne
  // la montre pas. Seul un vrai problème de configuration mérite un log.
  if (error) console.warn("lien_magique", error.message);
  return { envoye: true as const, email: parsed.data.email };
}
