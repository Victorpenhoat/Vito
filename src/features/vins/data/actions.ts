"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { creerVinSchema, degustationCompleteSchema, correctionAnalyseSchema } from "../domain/schemas";
import { tagSlug } from "@/features/restos/domain/tagSlug";
import { getVinLabelProvider } from "@/lib/services/vin-label";
import type { Json, TablesUpdate } from "@/types/database.types";
import { encryptDocument, decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

function parseCepages(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
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
  // La cuvée était lue sur l'étiquette puis perdue faute de colonne (00040).
  if (d.cuvee) maj.cuvee = d.cuvee;
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

  // Volontairement AUCUNE revalidation ici : la création est suivie de l'étape 2
  // (« Ma dégustation »), et rien à l'écran ne dépend d'un rafraîchissement à cet
  // instant. En demander un relance l'arbre RSC de la page courante pendant la
  // transition de l'action — c'est la course routeur Next connue (PR #71), qui
  // laissait la modale bloquée sur l'étape 1. La dégustation, elle, revalide ce
  // qu'elle change.
  return { ok: true as const, vinId: vinId as string };
}

// ── Vins & Cave (Lot V-C) : ma dégustation, correction, relance d'analyse ───

/** Tags cochés + tags créés à la volée, tous en portée « vin ». */
async function attacherTags(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  degustationId: string,
  tagIds: string[],
  nouveaux: string[],
): Promise<void> {
  const ids = [...tagIds];
  for (const label of nouveaux) {
    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: userId, slug: tagSlug(label), label, scope: "vin", categorie: "ambiance", is_system: false })
      .select("id")
      .single();
    if (!error && data) { ids.push(data.id); continue; }
    // Déjà créé (23505) : on retrouve le tag plutôt que d'échouer — l'utilisateur
    // a simplement retapé un tag qu'il possède déjà.
    if (error?.code === "23505") {
      const { data: existant } = await supabase
        .from("tags").select("id").eq("slug", tagSlug(label)).eq("scope", "vin").maybeSingle();
      if (existant) ids.push(existant.id);
    } else {
      logActionError("vins.attacherTags", error);
    }
  }
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("degustation_tags")
    .insert([...new Set(ids)].map((tag_id) => ({ degustation_id: degustationId, tag_id })));
  if (error) logActionError("vins.attacherTags", error);
}

/**
 * Ma dégustation (design écran 3) : note en verres, tags de verdict, prix avec
 * son unité, lieu (visite liée ou lieu libre) et envie de le retrouver.
 * Le vin existe déjà — il a été créé à la capture d'étiquette.
 */
export async function enregistrerDegustation(_prev: unknown, formData: FormData) {
  const parsed = degustationCompleteSchema.safeParse({
    vinId: formData.get("vinId"),
    note: formData.get("note") || undefined,
    commentaire: formData.get("commentaire") ?? "",
    prixPaye: formData.get("prixPaye") || undefined,
    prixUnite: formData.get("prixUnite") || undefined,
    lieuType: formData.get("lieuType") || undefined,
    lieuNom: formData.get("lieuNom") ?? "",
    etablissementId: formData.get("etablissementId") || undefined,
    visiteId: formData.get("visiteId") || undefined,
    degusteLe: formData.get("degusteLe") || undefined,
    aRacheter: formData.get("aRacheter") === "on" || formData.get("aRacheter") === "true",
    tagIds: formData.getAll("tagIds").filter((v): v is string => typeof v === "string"),
    nouveauxTags: formData.getAll("nouveauxTags")
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim()),
  });
  if (!parsed.success) return { error: "Saisie invalide" };
  const d = parsed.data;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  const { data: degustation, error } = await supabase
    .from("degustations")
    .insert({
      user_id: auth.user.id,
      vin_id: d.vinId,
      etablissement_id: d.etablissementId ?? null,
      visite_id: d.visiteId ?? null,
      ...(d.degusteLe !== undefined ? { deguste_le: d.degusteLe } : {}),
      note: d.note ?? null,
      prix_paye: d.prixPaye ?? null,
      prix_unite: d.prixUnite ?? null,
      // Un restaurant est identifié par son établissement : le lieu libre ne
      // sert qu'aux autres cas, sinon on aurait deux vérités pour le même lieu.
      lieu_type: d.etablissementId ? "restaurant" : (d.lieuType ?? null),
      lieu_nom: d.etablissementId ? null : (d.lieuNom || null),
      a_racheter: d.aRacheter,
      commentaire: d.commentaire || null,
    })
    .select("id")
    .single();
  if (error || !degustation) {
    logActionError("vins.enregistrerDegustation", error);
    return { error: "Enregistrement de la dégustation échoué" };
  }

  await attacherTags(supabase, auth.user.id, degustation.id, d.tagIds, d.nouveauxTags);

  if (d.etablissementId) revalidatePath(`/restos/${d.etablissementId}`);
  revalidatePath("/restos", "layout");
  revalidatePath(`/vins/${d.vinId}`);
  return { ok: true as const, degustationId: degustation.id };
}

/**
 * Correction d'une fiche générée (design écran 9). Une chaîne vide efface :
 * c'est le seul moyen de retirer une information que le modèle a inventée.
 */
export async function corrigerVin(_prev: unknown, formData: FormData) {
  const parsed = correctionAnalyseSchema.safeParse({
    vinId: formData.get("vinId"),
    domaine: formData.get("domaine") ?? undefined,
    cuvee: formData.get("cuvee") ?? undefined,
    appellation: formData.get("appellation") ?? undefined,
    region: formData.get("region") ?? undefined,
    millesime: formData.get("millesime") ?? undefined,
    degre: formData.get("degre") ?? undefined,
    couleur: formData.get("couleur") ?? undefined,
    cepages: parseCepages(formData.get("cepages")),
  });
  if (!parsed.success) return { error: "Saisie invalide" };
  const d = parsed.data;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  const maj: TablesUpdate<"vins"> = {};
  const texte = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
  if (texte(d.domaine) !== undefined) maj.domaine = texte(d.domaine);
  if (texte(d.cuvee) !== undefined) maj.cuvee = texte(d.cuvee);
  if (texte(d.appellation) !== undefined) maj.appellation = texte(d.appellation);
  if (texte(d.region) !== undefined) maj.region = texte(d.region);
  if (d.millesime !== undefined) maj.millesime = d.millesime === "" ? null : d.millesime;
  if (d.degre !== undefined) maj.degre = d.degre === "" ? null : d.degre;
  if (d.couleur !== undefined && d.couleur !== "") maj.couleur = d.couleur;
  if (d.cepages.length > 0) maj.cepages = d.cepages;

  if (Object.keys(maj).length === 0) return { ok: true as const };
  const { error } = await supabase.from("vins").update(maj).eq("id", d.vinId);
  if (error) { logActionError("vins.corrigerVin", error); return { error: "Correction non enregistrée" }; }
  revalidatePath(`/vins/${d.vinId}`);
  revalidatePath("/restos", "layout");
  return { ok: true as const };
}

/**
 * Relance l'analyse (design écran 9), à partir de la photo d'étiquette stockée
 * si elle existe, et TOUJOURS avec les champs corrigés en indice : c'est le sens
 * du bouton « Relancer l'analyse avec ces corrections ».
 */
export async function relancerAnalyse(_prev: unknown, formData: FormData) {
  const vinId = formData.get("vinId");
  if (typeof vinId !== "string") return { error: "Entrée invalide" };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  // RLS owner : un vin qui n'est pas le sien ne remonte pas.
  const { data: vin, error: lecture } = await supabase
    .from("vins")
    .select("nom, domaine, cuvee, appellation, region, millesime, cepages, etiquette_chiffree, etiquette_mime")
    .eq("id", vinId)
    .maybeSingle();
  if (lecture || !vin) return { error: "Vin introuvable" };

  let bytes: Buffer | null = null;
  if (vin.etiquette_chiffree) {
    try {
      bytes = decryptDocument(Buffer.from(vin.etiquette_chiffree, "base64"), getDocumentKey());
    } catch (err) {
      // Une étiquette illisible ne doit pas bloquer la relance : on repart des
      // champs corrigés, ce qui reste mieux que rien.
      logActionError("vins.relancerAnalyse", err);
    }
  }

  const indice = [vin.domaine, vin.cuvee, vin.appellation, vin.region, vin.millesime, ...(vin.cepages ?? [])]
    .filter(Boolean).join(" ") || vin.nom;

  let resultat;
  try {
    resultat = await getVinLabelProvider().read(bytes, bytes ? vin.etiquette_mime : null, indice);
  } catch (err) {
    logActionError("vins.relancerAnalyse", err);
    return { error: "Analyse indisponible" };
  }
  if (resultat.illisible && !resultat.analyse) return { error: "Analyse indisponible" };

  const { error } = await supabase
    .from("vins")
    .update({
      analyse_contenu: (resultat.analyse ?? null) as Json,
      analyse_confiance: resultat.confiance as Json,
      analyse_at: new Date().toISOString(),
      analyse_modele: resultat.modele,
    })
    .eq("id", vinId);
  if (error) { logActionError("vins.relancerAnalyse", error); return { error: "Analyse non enregistrée" }; }
  revalidatePath(`/vins/${vinId}`);
  return { ok: true as const };
}
