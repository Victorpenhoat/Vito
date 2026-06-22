import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  // RLS can_access_voyage : un non-membre n'obtient aucune ligne -> 404 (aucune fuite).
  const { data, error } = await supabase
    .from("voyage_documents")
    .select("nom, mime_type, contenu_chiffre")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  let bytes: Buffer;
  try {
    bytes = decryptDocument(Buffer.from(data.contenu_chiffre, "base64"), getDocumentKey());
  } catch {
    return NextResponse.json({ error: "déchiffrement" }, { status: 500 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": data.mime_type,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(data.nom)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
