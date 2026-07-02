import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/session";

const intlProxy = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // 1) Session d'abord : un éventuel refresh de JWT est écrit sur request.cookies.
  const refreshed = await updateSession(request);
  // 2) i18n ensuite : next-intl fige les headers (cookies inclus) de la requête
  //    dans sa réponse next/rewrite → le rendu aval voit le token frais.
  const response = intlProxy(request);
  // 3) Propager le refresh au navigateur (y compris sur un redirect de locale).
  refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
