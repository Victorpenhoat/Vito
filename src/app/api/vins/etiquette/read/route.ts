import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getVinLabelProvider } from "@/lib/services/vin-label";

// Lecture d'une étiquette (design Vins & Cave écran 2) : analyse à la volée,
// RIEN n'est persisté ici — la photo n'est stockée (chiffrée) qu'à la création
// du vin, quand l'utilisateur a validé les champs.
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non_authentifie" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const hintBrut = form.get("hint");
  const hint = typeof hintBrut === "string" ? hintBrut : undefined;

  // Photo OU description libre (recherche sans photo, écran 10)
  if (!(file instanceof File) && !hint?.trim()) {
    return NextResponse.json({ error: "entree_invalide" }, { status: 400 });
  }
  if (file instanceof File) {
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "type_non_supporte" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX) return NextResponse.json({ error: "taille_invalide" }, { status: 400 });
  }

  try {
    const bytes = file instanceof File ? Buffer.from(await file.arrayBuffer()) : null;
    const mime = file instanceof File ? file.type : null;
    const result = await getVinLabelProvider().read(bytes, mime, hint);
    return NextResponse.json(
      { fields: result.fields, confiance: result.confiance, analyse: result.analyse, illisible: result.illisible, modele: result.modele },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    console.error("vin_label_error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "lecture_indisponible" }, { status: 502 });
  }
}
