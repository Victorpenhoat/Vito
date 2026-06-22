"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { encryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_TAILLE = 5 * 1024 * 1024;

export async function ajouterDocument(_prev: unknown, formData: FormData) {
  const voyageId = formData.get("voyageId");
  const file = formData.get("file");
  if (typeof voyageId !== "string" || !(file instanceof File)) return { error: "Entrée invalide" };
  if (!ALLOWED.includes(file.type)) return { error: "Type non supporté" };
  if (file.size <= 0 || file.size > MAX_TAILLE) return { error: "Fichier vide ou trop volumineux (max 5 Mo)" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  let chiffre: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    chiffre = encryptDocument(buf, getDocumentKey()).toString("base64");
  } catch {
    return { error: "Chiffrement indisponible" };
  }
  const { error } = await supabase.from("voyage_documents").insert({
    voyage_id: voyageId,
    nom: file.name,
    mime_type: file.type,
    taille: file.size,
    contenu_chiffre: chiffre,
    uploaded_by: auth.user.id,
  });
  if (error) return { error: "Dépôt échoué" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

export async function supprimerDocument(_prev: unknown, formData: FormData) {
  const id = formData.get("documentId");
  const voyageId = formData.get("voyageId");
  if (typeof id !== "string" || typeof voyageId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("voyage_documents").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}
