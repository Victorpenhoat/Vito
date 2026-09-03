import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Export de ses données (design Onboarding écran 16).
//
// Choix assumé : l'archive est produite et téléchargée IMMÉDIATEMENT, alors que
// le design annonçait un lien envoyé par e-mail. Aucun ordonnanceur ni SMTP
// n'est configuré dans ce projet : promettre un e-mail qui n'arriverait pas
// serait pire qu'un téléchargement direct. Le volume d'un carnet personnel s'y
// prête (quelques centaines de lignes).
//
// Les scans et étiquettes ne sont PAS inclus : ils sont chiffrés, volumineux, et
// une archive en clair irait à l'encontre du reste du chantier. Ils restent
// consultables un par un, après vérification d'identité.

/** Tables exportées : tout ce que l'utilisateur a saisi, sous RLS owner. */
const TABLES = [
  "liste_items",
  "visites",
  "avis",
  "vins",
  "degustations",
  "voyages",
  "reservations",
  "depenses",
  "depense_parts",
  "family_members",
  "profil_gouts",
  "tags",
] as const;

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non_authentifie" }, { status: 401 });

  const { data: profil } = await supabase
    .from("profiles")
    .select("first_name, last_name, display_name, role, locale, created_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  const donnees: Record<string, unknown> = {
    exporte_le: new Date().toISOString(),
    compte: { email: auth.user.email, ...(profil ?? {}) },
    // Ce que l'archive ne contient pas, dit explicitement.
    note: "Les scans de documents et photos d'étiquettes ne sont pas inclus : ils sont chiffrés et se consultent un par un depuis l'application.",
  };

  for (const table of TABLES) {
    // La RLS limite chaque lecture aux lignes de l'utilisateur : aucune
    // possibilité d'emporter les données d'un autre compte.
    const { data, error } = await supabase.from(table).select("*");
    donnees[table] = error ? { erreur: error.message } : (data ?? []);
  }

  const corps = JSON.stringify(donnees, null, 2);
  const jour = new Date().toISOString().slice(0, 10);
  return new NextResponse(corps, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vito-mes-donnees-${jour}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
