import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

export type RefreshedCookie = { name: string; value: string; options: CookieOptions };

// Pattern officiel Supabase SSR : quand getUser() rafraîchit le JWT, les cookies
// doivent être écrits sur la REQUÊTE (le rendu RSC aval de cette même requête lit
// request.cookies — sinon il voit le token périmé et chaque createServerSupabase
// re-refresh dans son coin) ET retournés à l'appelant pour être posés sur la
// réponse (Set-Cookie navigateur). La réponse est construite par le proxy APRÈS
// cet appel : next-intl fige les headers de la requête au moment où il crée la
// sienne, donc l'ordre session → i18n est requis.
export async function updateSession(request: NextRequest): Promise<RefreshedCookie[]> {
  const refreshed: RefreshedCookie[] = [];
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          refreshed.push(...toSet);
        },
      },
    }
  );
  await supabase.auth.getUser();
  return refreshed;
}
