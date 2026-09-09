import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/session";
import { construireCsp, origine } from "@/lib/securite/entetes";

const intlProxy = createMiddleware(routing);

// La CSP est encore en Report-Only : elle ne bloque rien, elle rapporte. Le
// passage en vigueur se fera une fois /api/csp-report resté muet sur un
// parcours complet. Poser une CSP stricte d'emblée sur une app qui rend
// Leaflet, un service worker et quatre locales, c'est casser en prod ce qu'on
// n'a pas mesuré.
const ENTETE_CSP = "content-security-policy-report-only";

export default async function proxy(request: NextRequest) {
  // 1) Session d'abord : un éventuel refresh de JWT est écrit sur request.cookies.
  const refreshed = await updateSession(request);

  // 2) Nonce, puis CSP. Next relit l'en-tête sur la REQUÊTE pour poser la nonce
  //    sur ses propres scripts (app-render.js la cherche aussi en Report-Only) :
  //    sans ce passage par la requête, la mesure serait fausse — on rapporterait
  //    des violations que la politique appliquée n'aurait pas.
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = construireCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    supabase: origine(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sentry: origine(process.env.NEXT_PUBLIC_SENTRY_DSN),
  });

  // Les GET seuls sont rendus en HTML. Reconstruire la requête d'une action
  // serveur (POST) risquerait son corps pour une nonce qui ne sert à rien là.
  const requete = request.method === "GET" ? avecEntetes(request, nonce, csp) : request;

  // 3) i18n : next-intl recopie les en-têtes de la requête dans sa réponse
  //    next/rewrite → le rendu aval voit le token frais ET la nonce.
  const response = intlProxy(requete);

  // 4) Propager le refresh au navigateur (y compris sur un redirect de locale).
  refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set(ENTETE_CSP, csp);
  return response;
}

/** Requête jumelle portant la nonce, sans toucher à l'originale. */
function avecEntetes(request: NextRequest, nonce: string, csp: string): NextRequest {
  const entetes = new Headers(request.headers);
  entetes.set("x-nonce", nonce);
  entetes.set(ENTETE_CSP, csp);
  return new NextRequest(request, { headers: entetes });
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
