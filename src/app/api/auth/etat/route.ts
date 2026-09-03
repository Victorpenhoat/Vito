import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Sondage d'état de session : permet à l'écran « Ouvrez le lien reçu » de se
// mettre à jour tout seul quand le lien est ouvert sur un autre appareil
// (design Onboarding écran 3, desktop). Ne renvoie qu'un booléen — aucune
// information sur le compte.
export async function GET() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return NextResponse.json(
    { connecte: Boolean(data.user) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
