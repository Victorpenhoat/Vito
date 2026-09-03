import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

// Photo d'étiquette : stockée chiffrée en colonne (aucun bucket), servie ici en
// clair au seul propriétaire — la RLS owner-only fait le contrôle d'accès,
// un non-owner n'obtient aucune ligne donc un 404 (aucune fuite d'existence).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("vins")
    .select("etiquette_chiffree, etiquette_mime")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.etiquette_chiffree || !data.etiquette_mime) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  let bytes: Buffer;
  try {
    bytes = decryptDocument(Buffer.from(data.etiquette_chiffree, "base64"), getDocumentKey());
  } catch {
    return NextResponse.json({ error: "déchiffrement" }, { status: 500 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": data.etiquette_mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
