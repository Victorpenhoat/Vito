"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEnrichmentProvider } from "@/lib/services/enrichment";
import { degustationInputSchema, creerVinSchema } from "../domain/schemas";
import type { Json, TablesUpdate } from "@/types/database.types";
import { encryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

function parseCepages(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
}

export async function addDegustation(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: true }> {
  const parsed = degustationInputSchema.safeParse({
    nom: formData.get("nom"),
    domaine: formData.get("domaine") || undefined,
    millesime: formData.get("millesime") || undefined,
    region: formData.get("region") || undefined,
    couleur: formData.get("couleur") || undefined,
    cepages: parseCepages(formData.get("cepages")),
    etablissementId: formData.get("etablissementId") || undefined,
    avisId: formData.get("avisId") || undefined,
    degusteLe: formData.get("degusteLe") || undefined,
    note: formData.get("note") || undefined,
    prixPaye: formData.get("prixPaye") || undefined,
    commentaire: formData.get("commentaire") || undefined,
  });
  if (!parsed.success) return { error: "Saisie invalide" };
  const input = parsed.data;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  let norm: Awaited<ReturnType<ReturnType<typeof getEnrichmentProvider>["normalize"]>>;
  try {
    norm = await getEnrichmentProvider().normalize({
      nom: input.nom,
      domaine: input.domaine ?? null,
      millesime: input.millesime ?? null,
      region: input.region ?? null,
      couleur: input.couleur ?? null,
      cepages: input.cepages,
    });
  } catch {
    return { error: "Normalisation du vin échouée" };
  }

  const { data: vinId, error: vinErr } = await supabase.rpc("find_or_create_vin", {
    p: {
      nom: norm.nom,
      domaine: norm.domaine ?? "",
      millesime: norm.millesime,
      region: norm.region ?? "",
      couleur: norm.couleur,
      cepages: norm.cepages,
    },
  });
  if (vinErr || !vinId) { logActionError("vins.addDegustation", vinErr); return { error: "Enregistrement du vin échoué" }; }

  const { error: degErr } = await supabase.from("degustations").insert({
    user_id: auth.user.id,
    vin_id: vinId,
    etablissement_id: input.etablissementId ?? null,
    avis_id: input.avisId ?? null,
    ...(input.degusteLe !== undefined ? { deguste_le: input.degusteLe } : {}),
    note: input.note ?? null,
    prix_paye: input.prixPaye ?? null,
    commentaire: input.commentaire ?? null,
  });
  if (degErr) { logActionError("vins.addDegustation", degErr); return { error: "Enregistrement de la dégustation échoué" }; }

  if (input.etablissementId) revalidatePath(`/restos/${input.etablissementId}`);
  revalidatePath("/vins");
  return { ok: true as const };
}

export async function deleteDegustation(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: true }> {
  const id = formData.get("degustationId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data: deleted, error } = await supabase.from("degustations").delete().eq("id", id).select("id").maybeSingle();
  if (error) { logActionError("vins.deleteDegustation", error); return { error: "Suppression échouée" }; }
  if (!deleted) return { error: "Dégustation introuvable" };
  revalidatePath("/vins");
  return { ok: true as const };
}

// ── Vins & Cave (Lot V-B) : création d'un vin depuis une étiquette ───────────

/**
 * Crée (ou retrouve) le vin correspondant aux champs confirmés par l'utilisateur,
 * y attache l'analyse générée et la photo d'étiquette CHIFFRÉE (AES-256-GCM,
 * même convention que les documents du Cercle : aucun bucket, lecture par route
 * protégée). Retourne l'id du vin pour enchaîner sur la dégustation.
 */
export async function creerVinDepuisEtiquette(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: true; vinId?: string }> {
  const parsed = creerVinSchema.safeParse({
    nom: formData.get("nom"),
    domaine: formData.get("domaine") ?? "",
    cuvee: formData.get("cuvee") ?? "",
    appellation: formData.get("appellation") ?? "",
    millesime: formData.get("millesime") || undefined,
    region: formData.get("region") ?? "",
    couleur: formData.get("couleur") || undefined,
    cepages: parseCepages(formData.get("cepages")),
    degre: formData.get("degre") || undefined,
    analyse: formData.get("analyse") || undefined,
    confiance: formData.get("confiance") || undefined,
    modele: formData.get("modele") || undefined,
  });
  if (!parsed.success) return { error: "Saisie invalide" };
  const d = parsed.data;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  // Dédoublonnage : la RPC upsert sur (user, nom, millésime, domaine) — c'est
  // elle qui répond « vous avez déjà bu ce vin ».
  const { data: vinId, error: vinErr } = await supabase.rpc("find_or_create_vin", {
    p: {
      nom: d.nom,
      domaine: d.domaine ?? "",
      millesime: d.millesime ?? null,
      region: d.region ?? "",
      couleur: d.couleur ?? null,
      cepages: d.cepages,
    },
  });
  if (vinErr || !vinId) { logActionError("vins.creerVinDepuisEtiquette", vinErr); return { error: "Enregistrement du vin échoué" }; }

  // Champs v2 + analyse : UPDATE sous RLS owner (la RPC historique ne les porte pas).
  const maj: TablesUpdate<"vins"> = {};
  if (d.appellation) maj.appellation = d.appellation;
  if (d.degre !== undefined) maj.degre = d.degre;
  if (d.analyse) {
    try { maj.analyse_contenu = JSON.parse(d.analyse) as Json; } catch { /* analyse illisible : ignorée */ }
  }
  if (d.confiance) {
    try { maj.analyse_confiance = JSON.parse(d.confiance) as Json; } catch { /* idem */ }
  }
  if (maj.analyse_contenu || maj.analyse_confiance) {
    maj.analyse_at = new Date().toISOString();
    if (d.modele) maj.analyse_modele = d.modele;
  }

  // Photo d'étiquette : chiffrée avant stockage, jamais en clair en base.
  const photo = formData.get("etiquette");
  if (photo instanceof File && photo.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return { error: "Format d'image non supporté" };
    if (photo.size > 10 * 1024 * 1024) return { error: "Image trop lourde (10 Mo maximum)" };
    try {
      const clair = Buffer.from(await photo.arrayBuffer());
      maj.etiquette_chiffree = encryptDocument(clair, getDocumentKey()).toString("base64");
      maj.etiquette_mime = photo.type;
      maj.etiquette_taille = clair.length;
    } catch (err) {
      logActionError("vins.creerVinDepuisEtiquette", err);
      return { error: "Étiquette non enregistrée" };
    }
  }

  if (Object.keys(maj).length > 0) {
    const { error: majErr } = await supabase.from("vins").update(maj).eq("id", vinId);
    if (majErr) { logActionError("vins.creerVinDepuisEtiquette", majErr); return { error: "Enregistrement de l'analyse échoué" }; }
  }

  revalidatePath("/vins");
  revalidatePath(`/vins/${vinId}`);
  return { ok: true as const, vinId: vinId as string };
}
