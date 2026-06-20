import "server-only";
import { getLocale } from "next-intl/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import type { AppRole } from "./roles";

export async function getSessionRole(): Promise<AppRole | null> {
  const supabase = await createServerSupabase();

  // Tente d'abord getClaims() (lit le JWT depuis le cookie de session)
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) {
    const role = claimsData.claims["user_role"];
    if (role === "client" || role === "agence" || role === "admin") return role;
  }

  // Fallback : récupère l'utilisateur depuis le serveur Supabase et interroge profiles
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // On a un utilisateur mais le claim user_role manquait dans le JWT : le hook ne s'est pas
  // appliqué (token hérité / hook mal configuré). Signalé pour détecter la mauvaise config.
  console.warn(`[rbac] claim user_role absent du JWT, fallback profiles pour user ${user.id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role === "client" || role === "agence" || role === "admin") return role;
  return null;
}

export async function requireRole(roles: AppRole[]): Promise<AppRole> {
  const role = await getSessionRole();
  // Fail-closed : pas de rôle OU rôle non autorisé -> redirection (redirect() renvoie `never`,
  // donc TypeScript sait que `role` est un AppRole non nul après ce garde).
  if (!role || !roles.includes(role)) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }
  // `redirect` de next-intl n'est pas typé `never`, d'où l'assertion : à ce point le garde
  // ci-dessus a forcément redirigé si `role` était nul ou non autorisé.
  return role!;
}
