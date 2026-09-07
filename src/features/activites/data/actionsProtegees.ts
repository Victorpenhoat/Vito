"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifierMotDePasse } from "@/lib/auth/motDePasse";
import { chiffrerChamp, dechiffrerChamp } from "@/lib/crypto/champs";
import { encryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";
import { journaliser } from "@/lib/audit/journal";

// Sections protégées d'une activité : les codes d'accès et les documents.
//
// Deux règles tiennent tout :
//   1. rien n'est stocké en clair — même primitive de chiffrement que les
//      pièces d'identité du Cercle, même clé ;
//   2. une session valide ne vaut pas consentement RÉCENT. Révéler un code ou
//      ouvrir un certificat médical redemande le mot de passe, et laisse une
//      trace dans le journal.

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_TAILLE = 5 * 1024 * 1024;

/** Message unique quelle que soit la cause : on ne renseigne pas un curieux. */
const REFUS = { error: "Vérification impossible" };

export async function ajouterCode(_prev: unknown, formData: FormData) {
  const activiteId = formData.get("activiteId");
  const libelle = formData.get("libelle");
  const valeur = formData.get("valeur");
  const note = formData.get("note");
  if (typeof activiteId !== "string" || typeof libelle !== "string" || !libelle.trim()
      || typeof valeur !== "string" || !valeur.trim()) {
    return { error: "Entrée invalide" };
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  let chiffre: string;
  try {
    chiffre = chiffrerChamp(valeur.trim());
  } catch {
    // Sans clé de chiffrement, on n'enregistre RIEN : un code en clair « pour
    // dépanner » resterait en clair pour toujours.
    return { error: "Chiffrement indisponible" };
  }

  const { error } = await supabase.from("activite_codes").insert({
    activite_id: activiteId,
    libelle: libelle.trim().slice(0, 120),
    valeur_chiffree: chiffre,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  if (error) { logActionError("activites.ajouterCode", error); return { error: "Ajout échoué" }; }
  revalidatePath(`/activites/${activiteId}`);
  return { ok: true as const };
}

/**
 * Révèle un code. Le clair ne quitte le serveur qu'ICI, après vérification du
 * mot de passe — redemandée à chaque fois, comme pour les numéros du Cercle.
 */
export async function revelerCode(_prev: unknown, formData: FormData) {
  const codeId = formData.get("id");
  const motDePasse = formData.get("motDePasse");
  if (typeof codeId !== "string" || typeof motDePasse !== "string" || motDePasse === "") return REFUS;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: "Non authentifié" };
  if (!(await verifierMotDePasse(auth.user.email, motDePasse))) return REFUS;

  // La RLS fait le contrôle d'accès : un code qui n'est pas à moi ne remonte
  // pas, et le refus est le même que pour un mot de passe faux.
  const { data, error } = await supabase
    .from("activite_codes").select("valeur_chiffree").eq("id", codeId).maybeSingle();
  if (error || !data) return REFUS;
  const valeur = dechiffrerChamp(data.valeur_chiffree);
  if (!valeur) return REFUS;

  await journaliser(supabase, auth.user.id, "code_activite", codeId, "revelation");
  return { ok: true as const, valeur };
}

export async function supprimerCode(_prev: unknown, formData: FormData) {
  const codeId = formData.get("id");
  const activiteId = formData.get("activiteId");
  if (typeof codeId !== "string" || typeof activiteId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("activite_codes").delete().eq("id", codeId).select("id").maybeSingle();
  if (error || !data) return { error: "Suppression échouée" };
  revalidatePath(`/activites/${activiteId}`);
  return { ok: true as const };
}

export async function ajouterDocumentActivite(_prev: unknown, formData: FormData) {
  const activiteId = formData.get("activiteId");
  const type = formData.get("type");
  const file = formData.get("file");
  const expireLe = formData.get("expireLe");
  if (typeof activiteId !== "string" || typeof type !== "string" || !(file instanceof File)) {
    return { error: "Entrée invalide" };
  }
  if (!ALLOWED.includes(file.type)) return { error: "Type non supporté" };
  if (file.size <= 0 || file.size > MAX_TAILLE) return { error: "Fichier vide ou trop volumineux (max 5 Mo)" };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  let chiffre: string;
  try {
    chiffre = encryptDocument(Buffer.from(await file.arrayBuffer()), getDocumentKey()).toString("base64");
  } catch {
    return { error: "Chiffrement indisponible" };
  }

  const { data: cree, error } = await supabase.from("activite_documents").insert({
    activite_id: activiteId,
    type,
    // Un certificat médical est une donnée de santé : le marquer ici, c'est ce
    // qui fera exiger une vérification pour l'ouvrir.
    sensible: type === "certificat_medical",
    nom: file.name,
    contenu_chiffre: chiffre,
    mime_type: file.type,
    taille: file.size,
    expire_le: typeof expireLe === "string" && expireLe ? expireLe : null,
  }).select("id").single();
  if (error || !cree) { logActionError("activites.ajouterDocument", error); return { error: "Dépôt échoué" }; }

  revalidatePath(`/activites/${activiteId}`);
  return { ok: true as const, id: cree.id };
}

/**
 * Ouvre un document : délivre un ticket à usage unique que la route de lecture
 * exigera. Même mécanique que les scans du Cercle — le secret ne transite
 * qu'une fois, et la base n'en garde que le haché.
 */
export async function ouvrirDocumentActivite(_prev: unknown, formData: FormData) {
  const docId = formData.get("id");
  const motDePasse = formData.get("motDePasse");
  if (typeof docId !== "string" || typeof motDePasse !== "string" || motDePasse === "") return REFUS;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: "Non authentifié" };
  if (!(await verifierMotDePasse(auth.user.email, motDePasse))) return REFUS;

  const { randomBytes, createHash } = await import("node:crypto");
  const ticket = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(ticket).digest("hex");
  const { error } = await supabase.rpc("emettre_reauth_ticket", {
    p_hash: hash,
    p_cible: `activite_document:${docId}`,
  });
  if (error) { logActionError("activites.ouvrirDocument", error); return REFUS; }

  await journaliser(supabase, auth.user.id, "document_activite", docId, "ouverture");
  return { ok: true as const, ticket };
}

export async function supprimerDocumentActivite(_prev: unknown, formData: FormData) {
  const docId = formData.get("id");
  const activiteId = formData.get("activiteId");
  if (typeof docId !== "string" || typeof activiteId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("activite_documents").delete().eq("id", docId).select("id").maybeSingle();
  if (error || !data) return { error: "Suppression échouée" };
  revalidatePath(`/activites/${activiteId}`);
  return { ok: true as const };
}
