import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const face = req.nextUrl.searchParams.get("face");
  const supabase = await createServerSupabase();
  // RLS owner-only : un non-owner n'obtient aucune ligne -> 404 (aucune fuite).
  const { data, error } = await supabase
    .from("family_documents")
    .select("doc_type, mime_type, contenu_chiffre, mime_type_verso, contenu_chiffre_verso")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  // ?face=verso : seconde face optionnelle (404 si absente, même signal qu'un doc inconnu)
  const wantVerso = face === "verso";
  if (wantVerso && (!data.contenu_chiffre_verso || !data.mime_type_verso)) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  const contenu = wantVerso ? data.contenu_chiffre_verso! : data.contenu_chiffre;
  const mime = wantVerso ? data.mime_type_verso! : data.mime_type;
  let bytes: Buffer;
  try {
    bytes = decryptDocument(Buffer.from(contenu, "base64"), getDocumentKey());
  } catch {
    return NextResponse.json({ error: "déchiffrement" }, { status: 500 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
