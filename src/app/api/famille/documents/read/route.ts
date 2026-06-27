import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOcrProvider } from "@/lib/services/ocr";

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non_authentifie" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const docType = form.get("docType");
  if (!(file instanceof File) || typeof docType !== "string") {
    return NextResponse.json({ error: "entree_invalide" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "type_non_supporte" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX) return NextResponse.json({ error: "taille_invalide" }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await getOcrProvider().read(buf, file.type, docType);
    return NextResponse.json(
      { fields: result.fields, raw: result.raw },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    console.error("ocr_error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "lecture_indisponible" }, { status: 502 });
  }
}
