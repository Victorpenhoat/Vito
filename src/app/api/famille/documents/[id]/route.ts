import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const face = req.nextUrl.searchParams.get("face");
  const supabase = await createServerSupabase();

  // Données protégées (lot O-D) : un scan d'identité ne s'ouvre qu'avec un
  // ticket à usage unique, obtenu après vérification du mot de passe. La RLS
  // seule ne suffit pas — une session valide ne vaut pas consentement récent.
  const ticket = req.nextUrl.searchParams.get("ticket");
  if (!ticket) return NextResponse.json({ error: "verification_requise" }, { status: 401 });
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(ticket).digest("hex");
  const { data: valide, error: ticketErr } = await supabase.rpc("consommer_reauth_ticket", {
    p_hash: hash,
    p_cible: `document:${id}:${face === "verso" ? "verso" : "recto"}`,
  });
  if (ticketErr || valide !== true) {
    return NextResponse.json({ error: "verification_requise" }, { status: 401 });
  }
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
