import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        // Passkeys (Onboarding lot O-E) : le SDK expose auth.passkey.* et
        // signInWithPasskey() derrière ce drapeau — sans lui, tout appel lève
        // une erreur. Côté serveur, [auth.passkey] est activé dans config.toml
        // (nécessite un CLI Supabase ≥ 2.116 : les versions antérieures ne
        // transmettaient pas la configuration au conteneur).
        experimental: { passkey: true },
      },
    },
  );
}
