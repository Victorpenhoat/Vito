import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // appelé depuis un Server Component : ignoré (le middleware rafraîchit)
          }
        },
      },
    }
  );
}

// Authentification dédupliquée par requête : chaque lecture RSC appelait
// supabase.auth.getUser() (un aller-retour au serveur Auth), soit ~4 appels pour une
// seule page (layout + plusieurs queries). cache() (React, request-scoped) ne fait
// l'appel qu'une fois par requête. Retourne { user } — même forme que data de getUser,
// pour que les sites appelants (auth.user) restent inchangés.
export const getCachedUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data;
});
