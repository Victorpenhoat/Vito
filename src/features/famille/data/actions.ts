"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";
import { familleInputSchema, inviteSchema, procheInputSchema, documentInputSchema, type ProcheInput } from "../domain/schemas";
import { encryptDocument } from "@/lib/crypto/documents";
import { chiffrerChamp, dechiffrerChamp } from "@/lib/crypto/champs";
import { verifierMotDePasse } from "@/lib/auth/motDePasse";
import { getDocumentKey } from "@/lib/crypto/documentKey";
import { avatarColor } from "../domain/avatarColor";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// id de la famille de l'utilisateur (possédée ou rejointe), ou null
async function maFamilleId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.from("familles").select("id, owner_id").maybeSingle();
  return data ?? null;
}

export async function creerFamille(_prev: unknown, formData: FormData) {
  const parsed = familleInputSchema.safeParse({ nom: formData.get("nom") });
  if (!parsed.success) return { error: "Nom invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const { error } = await supabase.from("familles").insert({ owner_id: uid, nom: parsed.data.nom });
  if (error) {
    // le trigger owner-membre viole UNIQUE(profile_id) si déjà dans une famille
    if (error.code === "23505" || error.message?.includes("unique")) return { error: "Vous êtes déjà dans une famille" };
    logActionError("famille.creerFamille", error);
    return { error: "Création échouée" };
  }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function inviterMembre(_prev: unknown, formData: FormData) {
  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { data, error } = await supabase.rpc("inviter_famille", { p_famille_id: fam.id, p_email: parsed.data.email });
  if (error) { logActionError("famille.inviterMembre", error); return { error: "Invitation échouée" }; }
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous êtes déjà membre" };
  if (data === "deja_famille") return { error: "Cette personne est déjà dans une famille" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function retirerMembre(_prev: unknown, formData: FormData) {
  const profileId = formData.get("profileId");
  if (typeof profileId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.rpc("retirer_membre_famille", { p_famille_id: fam.id, p_profile_id: profileId });
  if (error) { logActionError("famille.retirerMembre", error); return { error: "Retrait échoué" }; }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function quitterFamille(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("quitter_famille");
  if (error) { logActionError("famille.quitterFamille", error); return { error: "Impossible de quitter" }; }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function supprimerFamille(_prev: unknown, _formData: FormData) {
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  // RLS delete = owner-only ; .select() détecte 0 ligne (non owner)
  const { data, error } = await supabase.from("familles").delete().eq("id", fam.id).select("id").maybeSingle();
  if (error) { logActionError("famille.supprimerFamille", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function ajouterRestoFiche(_prev: unknown, formData: FormData) {
  const etablissementId = formData.get("etablissementId");
  if (typeof etablissementId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.from("famille_restos").upsert(
    { famille_id: fam.id, etablissement_id: etablissementId, added_by: uid },
    { onConflict: "famille_id,etablissement_id" },
  );
  if (error) { logActionError("famille.ajouterRestoFiche", error); return { error: "Ajout échoué" }; }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function ajouterRestoRecherche(_prev: unknown, formData: FormData) {
  const placeId = formData.get("placeId");
  if (typeof placeId !== "string" || !placeId) return { error: "Place invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const place = await getPlacesProvider().details(placeId);
  if (!place) return { error: "Établissement introuvable" };
  const input = mapPlaceToEtablissement(place);
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", { p: { ...input, enriched_at: new Date().toISOString() } });
  if (rpcErr || !etabId) { logActionError("famille.ajouterRestoRecherche", rpcErr); return { error: "Enregistrement échoué" }; }
  const { error } = await supabase.from("famille_restos").upsert(
    { famille_id: fam.id, etablissement_id: etabId, added_by: uid },
    { onConflict: "famille_id,etablissement_id" },
  );
  if (error) { logActionError("famille.ajouterRestoRecherche", error); return { error: "Ajout échoué" }; }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function retirerResto(_prev: unknown, formData: FormData) {
  const etablissementId = formData.get("etablissementId");
  if (typeof etablissementId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const fam = await maFamilleId(supabase);
  if (!fam) return { error: "Aucune famille" };
  const { error } = await supabase.from("famille_restos").delete().eq("famille_id", fam.id).eq("etablissement_id", etablissementId);
  if (error) { logActionError("famille.retirerResto", error); return { error: "Retrait échoué" }; }
  revalidatePath("/famille");
  return { ok: true as const };
}

export async function chercherEtablissements(query: string) {
  if (!query.trim()) return [];
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return [];
  return getPlacesProvider().search(query);
}

function clean(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function parseProche(formData: FormData) {
  return procheInputSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    relation: formData.get("relation"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    birth_date: formData.get("birth_date") ?? "",
    birth_place: formData.get("birth_place") ?? "",
    address: formData.get("address") ?? "",
    address_inherit: formData.get("address_inherit") === "on",
  });
}

// Valeurs communes insert/update (circle : défaut DB 'proche', plus exposé au formulaire)
function procheValues(p: ProcheInput, formData: FormData) {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    relation: p.relation,
    phone: clean(formData.get("phone")),
    email: clean(formData.get("email")),
    birth_date: clean(formData.get("birth_date")),
    birth_place: clean(formData.get("birth_place")),
    address: clean(formData.get("address")),
    address_inherit: p.address_inherit,
  };
}

export async function creerProche(_prev: unknown, formData: FormData) {
  const parsed = parseProche(formData);
  if (!parsed.success) return { error: "Champs invalides" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const p = parsed.data;
  const { data, error } = await supabase
    .from("family_members")
    .insert({
      user_id: uid,
      ...procheValues(p, formData),
      avatar_color: avatarColor(`${p.first_name} ${p.last_name}`),
    })
    .select("id")
    .single();
  if (error || !data) {
    // index partiel family_members_moi_unique : une seule fiche « Moi » par compte
    if (error?.code === "23505") return { error: "Vous avez déjà une fiche « Moi »" };
    logActionError("famille.creerProche", error);
    return { error: "Création échouée" };
  }
  revalidatePath("/famille");
  const locale = await getLocale();
  redirect({ href: `/famille/proches/${data.id}`, locale });
}

export async function modifierProche(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const parsed = parseProche(formData);
  if (!parsed.success) return { error: "Champs invalides" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const p = parsed.data;
  const { data, error } = await supabase
    .from("family_members")
    .update(procheValues(p, formData))
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà une fiche « Moi »" };
    logActionError("famille.modifierProche", error);
    return { error: "Modification échouée" };
  }
  if (!data) return { error: "Introuvable" };
  revalidatePath("/famille");
  revalidatePath(`/famille/proches/${id}`);
  const locale = await getLocale();
  redirect({ href: `/famille/proches/${id}`, locale });
}

export async function supprimerProche(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.from("family_members").delete().eq("id", id);
  if (error) { logActionError("famille.supprimerProche", error); return { error: "Suppression échouée" }; }
  revalidatePath("/famille");
  const locale = await getLocale();
  redirect({ href: "/famille", locale });
}

const DOC_ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const DOC_MAX = 10 * 1024 * 1024;

export async function creerDocument(_prev: unknown, formData: FormData) {
  const memberId = formData.get("memberId");
  const file = formData.get("file");
  if (typeof memberId !== "string" || !memberId || !(file instanceof File)) return { error: "Entrée invalide" };
  if (!DOC_ALLOWED.includes(file.type)) return { error: "Type non supporté" };
  if (file.size <= 0 || file.size > DOC_MAX) return { error: "Fichier vide ou trop volumineux (max 10 Mo)" };

  // Verso optionnel (refonte Cercle) : mêmes gardes que le recto, 10 Mo par face.
  const versoEntry = formData.get("file_verso");
  const verso = versoEntry instanceof File && versoEntry.size > 0 ? versoEntry : null;
  if (verso) {
    if (!DOC_ALLOWED.includes(verso.type)) return { error: "Type non supporté" };
    if (verso.size > DOC_MAX) return { error: "Fichier vide ou trop volumineux (max 10 Mo)" };
  }

  const parsed = documentInputSchema.safeParse({
    doc_type: formData.get("docType"),
    doc_label: formData.get("doc_label") ?? "",
    doc_number: formData.get("doc_number") ?? "",
    country: formData.get("country") ?? "",
    holder_name: formData.get("holder_name") ?? "",
    issue_date: formData.get("issue_date") ?? "",
    expiry_date: formData.get("expiry_date") ?? "",
    issue_place: formData.get("issue_place") ?? "",
  });
  if (!parsed.success) return { error: "Champs invalides" };

  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };

  const { data: member } = await supabase.from("family_members").select("id").eq("id", memberId).maybeSingle();
  if (!member) return { error: "Proche introuvable" };

  let chiffre: string;
  let chiffreVerso: string | null = null;
  try {
    const key = getDocumentKey();
    chiffre = encryptDocument(Buffer.from(await file.arrayBuffer()), key).toString("base64");
    if (verso) chiffreVerso = encryptDocument(Buffer.from(await verso.arrayBuffer()), key).toString("base64");
  } catch {
    return { error: "Chiffrement indisponible" };
  }

  // La lecture brute du modèle contient le plus souvent le numéro en toutes
  // lettres : elle est chiffrée au repos comme le scan (lot O-D bis).
  const ocrRawStr = formData.get("ocrRaw");
  const ocr_raw_chiffre =
    typeof ocrRawStr === "string" && ocrRawStr ? chiffrerChamp(ocrRawStr) : null;

  const p = parsed.data;
  const { error } = await supabase.from("family_documents").insert({
    user_id: uid,
    member_id: memberId,
    doc_type: p.doc_type,
    doc_label: p.doc_type === "autre" ? clean(formData.get("doc_label")) : null,
    // numéro chiffré au repos comme les scans (lot O-D)
    doc_number_chiffre: (() => {
      const brut = clean(formData.get("doc_number"));
      return brut ? chiffrerChamp(brut) : null;
    })(),
    country: clean(formData.get("country")),
    holder_name: clean(formData.get("holder_name")),
    issue_date: clean(formData.get("issue_date")),
    expiry_date: clean(formData.get("expiry_date")),
    issue_place: clean(formData.get("issue_place")),
    contenu_chiffre: chiffre,
    mime_type: file.type,
    taille: file.size,
    contenu_chiffre_verso: chiffreVerso,
    mime_type_verso: verso ? verso.type : null,
    taille_verso: verso ? verso.size : null,
    ocr_raw_chiffre,
  });
  if (error) { logActionError("famille.creerDocument", error); return { error: "Enregistrement échoué" }; }
  revalidatePath(`/famille/proches/${memberId}`);
  const locale = await getLocale();
  redirect({ href: `/famille/proches/${memberId}`, locale });
}

export async function modifierDocument(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const parsed = documentInputSchema.safeParse({
    doc_type: formData.get("docType"),
    doc_label: formData.get("doc_label") ?? "",
    doc_number: formData.get("doc_number") ?? "",
    country: formData.get("country") ?? "",
    holder_name: formData.get("holder_name") ?? "",
    issue_date: formData.get("issue_date") ?? "",
    expiry_date: formData.get("expiry_date") ?? "",
    issue_place: formData.get("issue_place") ?? "",
  });
  if (!parsed.success) return { error: "Champs invalides" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const p = parsed.data;
  const { data, error } = await supabase
    .from("family_documents")
    .update({
      doc_type: p.doc_type,
      doc_label: p.doc_type === "autre" ? clean(formData.get("doc_label")) : null,
      // champ vide = « ne pas toucher » (le formulaire ne réaffiche jamais
      // l'ancien numéro, il ne peut donc pas le renvoyer tel quel)
      ...(() => {
        const brut = clean(formData.get("doc_number"));
        return brut ? { doc_number_chiffre: chiffrerChamp(brut) } : {};
      })(),
      country: clean(formData.get("country")),
      holder_name: clean(formData.get("holder_name")),
      issue_date: clean(formData.get("issue_date")),
      expiry_date: clean(formData.get("expiry_date")),
      issue_place: clean(formData.get("issue_place")),
    })
    .eq("id", id)
    .select("member_id")
    .maybeSingle();
  if (error) { logActionError("famille.modifierDocument", error); return { error: "Modification échouée" }; }
  if (!data) return { error: "Introuvable" };
  revalidatePath(`/famille/proches/${data.member_id}`);
  const locale = await getLocale();
  redirect({ href: `/famille/proches/${data.member_id}/documents/${id}`, locale });
}

export async function supprimerDocument(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  // member_id vient du returning (RLS) — pas de confiance dans le formulaire
  const { data, error } = await supabase
    .from("family_documents")
    .delete()
    .eq("id", id)
    .select("member_id")
    .maybeSingle();
  if (error) { logActionError("famille.supprimerDocument", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Introuvable" };
  revalidatePath(`/famille/proches/${data.member_id}`);
  const locale = await getLocale();
  redirect({ href: `/famille/proches/${data.member_id}`, locale });
}

export async function toggleReminder(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  // valeur cible explicite (pas de flip serveur : évite un read-then-write)
  const reminder = formData.get("reminder") === "true";
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("family_documents")
    .update({ reminder })
    .eq("id", id)
    .select("member_id")
    .maybeSingle();
  if (error) { logActionError("famille.toggleReminder", error); return { error: "Modification échouée" }; }
  if (!data) return { error: "Introuvable" };
  revalidatePath(`/famille/proches/${data.member_id}/documents/${id}`);
  return { ok: true as const };
}

// ── Données protégées (Onboarding lot O-D) ─────────────────────────────────


/**
 * Révèle le numéro d'un document après vérification d'identité.
 * Le numéro n'est JAMAIS envoyé au navigateur avant cet appel : la page ne
 * reçoit qu'une forme masquée. Une vérification vaut pour UNE révélation
 * (décision PO : pas de fenêtre de validité).
 */
export async function revelerNumero(_prev: unknown, formData: FormData) {
  const docId = formData.get("docId");
  const motDePasse = formData.get("motDePasse");
  if (typeof docId !== "string" || typeof motDePasse !== "string" || motDePasse === "") {
    return { error: "Vérification impossible" };
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: "Non authentifié" };

  if (!(await verifierMotDePasse(auth.user.email, motDePasse))) {
    // message identique quelle que soit la cause : on ne renseigne pas un tiers
    return { error: "Vérification impossible" };
  }
  // La RLS owner-only fait le contrôle d'accès au document.
  const { data: doc, error } = await supabase
    .from("family_documents")
    .select("doc_number_chiffre")
    .eq("id", docId)
    .maybeSingle();
  if (error || !doc) return { error: "Vérification impossible" };
  const numero = dechiffrerChamp(doc.doc_number_chiffre);
  if (!numero) return { error: "Vérification impossible" };
  return { ok: true as const, numero };
}

/**
 * Ouvre un scan : délivre un ticket à usage unique (2 minutes) que la route de
 * lecture exigera. Le secret ne transite qu'une fois ; la base n'en garde que
 * le haché.
 */
export async function ouvrirScanProtege(_prev: unknown, formData: FormData) {
  const docId = formData.get("docId");
  const motDePasse = formData.get("motDePasse");
  const face = formData.get("face") === "verso" ? "verso" : "recto";
  if (typeof docId !== "string" || typeof motDePasse !== "string" || motDePasse === "") {
    return { error: "Vérification impossible" };
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: "Non authentifié" };
  if (!(await verifierMotDePasse(auth.user.email, motDePasse))) return { error: "Vérification impossible" };

  const { randomBytes, createHash } = await import("node:crypto");
  const ticket = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(ticket).digest("hex");
  const { error } = await supabase.rpc("emettre_reauth_ticket", {
    p_hash: hash,
    p_cible: `document:${docId}:${face}`,
  });
  if (error) { logActionError("famille.ouvrirScanProtege", error); return { error: "Vérification impossible" }; }
  return { ok: true as const, ticket };
}
