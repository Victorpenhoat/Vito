"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { getLocale, getTranslations } from "next-intl/server";
import { credentialsSchema } from "../domain/schemas";

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

export async function signUp(_prev: unknown, formData: FormData) {
  const t = await getTranslations("auth.errors");
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: t("invalidCredentials") };

  const supabase = await createServerSupabase();
  // Le rôle 'client' est forcé par le trigger DB handle_new_user — ne jamais le transmettre depuis l'UI.
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: t("signUpFailed") };
  const locale = await getLocale();
  redirect({ href: "/accueil", locale });
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/login", locale });
}
