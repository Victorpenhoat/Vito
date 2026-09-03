import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

// Retour du lien magique (Onboarding lot O-B). Sous /api : le proxy n'y touche
// pas et `verifyOtp` pose lui-même les cookies de session.
// En cas d'échec (lien expiré, déjà utilisé), on renvoie vers la connexion avec
// un motif neutre — jamais de détail sur le compte visé.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const suite = params.get("next");
  // `next` n'est suivi que s'il est relatif : pas de redirection ouverte.
  const destination = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/fr/accueil";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/fr/login?lien=invalide", req.url));
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.warn("confirm_otp", error.message);
    return NextResponse.redirect(new URL("/fr/login?lien=expire", req.url));
  }
  return NextResponse.redirect(new URL(destination, req.url));
}
