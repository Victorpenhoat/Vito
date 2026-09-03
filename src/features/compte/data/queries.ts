import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";

/** Profil du compte connecté (Réglages). null si pas de session. */
export async function getMonProfil() {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63) : page et layout rendent en parallèle.
  const auth = await getCachedUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, display_name, role, locale, created_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, email: auth.user.email ?? null } : null;
}
