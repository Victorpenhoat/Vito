import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

// Lecture d'un document d'activité (licence, certificat médical, assurance).
//
// Une session valide ne suffit pas : il faut un TICKET à usage unique, obtenu
// après vérification du mot de passe. C'est la même exigence que pour les scans
// d'identité du Cercle, et pour la même raison — un téléphone déverrouillé
// laissé sur une table est une session valide.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const ticket = req.nextUrl.searchParams.get("ticket");
  if (!ticket) return NextResponse.json({ error: "verification_requise" }, { status: 401 });
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(ticket).digest("hex");
  const { data: valide, error: ticketErr } = await supabase.rpc("consommer_reauth_ticket", {
    p_hash: hash,
    p_cible: `activite_document:${id}`,
  });
  if (ticketErr || valide !== true) {
    return NextResponse.json({ error: "verification_requise" }, { status: 401 });
  }

  // RLS : un document qui n'est pas à moi ne remonte pas — 404, aucune fuite.
  const { data, error } = await supabase
    .from("activite_documents").select("nom, mime_type, contenu_chiffre").eq("id", id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = decryptDocument(Buffer.from(data.contenu_chiffre, "base64"), getDocumentKey());
  } catch {
    return NextResponse.json({ error: "dechiffrement" }, { status: 500 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": data.mime_type,
      "Content-Disposition": "inline",
      // Jamais en cache : ni par le navigateur, ni par le service worker du
      // mode hors ligne. Un document protégé ne doit pas survivre à la session.
      "Cache-Control": "private, no-store",
    },
  });
}
