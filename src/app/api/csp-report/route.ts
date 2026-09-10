import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/log";

// Collecteur de violations CSP. Il a servi à mesurer avant de mordre ; il reste
// une fois la politique en vigueur, où il vaut plus encore : une violation n'y
// est plus un avertissement mais quelque chose de cassé chez un utilisateur,
// sur un navigateur ou un parcours que nos tests n'ont pas.
//
// Le corps est envoyé par le navigateur, donc non fiable : on n'en garde que
// quelques champs, tronqués, et jamais l'URL complète du document (elle porte
// des identifiants de fiche). Pas d'authentification ici — un rapport arrive
// justement quand la page a été bloquée.
export async function POST(request: NextRequest) {
  const brut: unknown = await request.json().catch(() => null);
  const rapport = extraireRapport(brut);
  if (rapport) log.warn("csp_violation", rapport);
  // 204 : le navigateur n'attend rien, et rien ne doit fuiter dans la réponse.
  return new NextResponse(null, { status: 204 });
}

function tronquer(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v.slice(0, 200) : undefined;
}

/** Ne retient que ce qui sert à corriger une directive, jamais le contexte utilisateur. */
export function extraireRapport(brut: unknown): Record<string, string> | null {
  if (typeof brut !== "object" || brut === null) return null;
  const enveloppe = (brut as { "csp-report"?: unknown })["csp-report"];
  const corps = typeof enveloppe === "object" && enveloppe !== null ? enveloppe : brut;
  const c = corps as Record<string, unknown>;
  const directive = tronquer(c["violated-directive"] ?? c["effective-directive"]);
  if (!directive) return null;
  const bloque = tronquer(c["blocked-uri"]);
  return { directive, ...(bloque ? { bloque } : {}) };
}
