import "server-only";
import { env } from "@/lib/env";

/**
 * Vérifie le mot de passe d'un compte SANS toucher à la session en cours.
 * On ouvre un client Supabase éphémère : un `signInWithPassword` sur le client
 * de la requête remplacerait les cookies de session de l'utilisateur.
 *
 * Sert aux gestes qui exigent un consentement récent : révéler une donnée
 * protégée, ouvrir un scan, déverrouiller l'application.
 */
export async function verifierMotDePasse(email: string, motDePasse: string): Promise<boolean> {
  if (!email || !motDePasse) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const ephemere = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await ephemere.auth.signInWithPassword({ email, password: motDePasse });
  if (!error) await ephemere.auth.signOut();
  return !error;
}
