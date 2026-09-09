import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/session";
import { construireCsp, origine } from "@/lib/securite/entetes";

const intlProxy = createMiddleware(routing);

// La CSP est EN VIGUEUR : ce qui n'est pas prévu est bloqué. Elle a d'abord
// vécu en Report-Only le temps de mesurer (ADR 0001) ; `report-uri` reste posé,
// car une violation renseigne autant quand elle bloque que quand elle rapporte.
//
// Conséquence à connaître avant de toucher au rendu : `script-src` porte
// 'strict-dynamic', qui fait IGNORER 'self' par le navigateur. Seuls les
// scripts portant la nonce se chargent — donc toute page rendue statiquement,
// dont le HTML est bâti sans requête et sans nonce, serait muette. Le test e2e
// « aucune page servie sans nonce » tient cette contrainte.
const ENTETE_CSP = "content-security-policy";

export default async function proxy(request: NextRequest) {
  // 1) Session d'abord : un éventuel refresh de JWT est écrit sur request.cookies.
  const refreshed = await updateSession(request);

  // 2) Nonce, puis CSP. Next relit l'en-tête sur la REQUÊTE pour poser la nonce
  //    sur ses propres scripts : sans ce passage par la requête, aucun script
  //    n'en porterait, et 'strict-dynamic' les bloquerait tous. La page se
  //    servirait, muette.
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
