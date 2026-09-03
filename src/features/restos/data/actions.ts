"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import type { SearchOpts } from "@/lib/services/places/types";
import { mapPlaceToEtablissement } from "../domain/mapPlaceToEtablissement";
import {
  addRestoSchema, addAvisSchema, setTagsSchema, toggleFavoriteSchema, toggleArchiveSchema,
  marquerVisiteSchema, changerStatutSchema, setOrigineSchema,
  marquerSejourSchema, setInfosHotelSchema,
} from "../domain/schemas";

export async function searchPlaces(query: string, opts?: SearchOpts) {
  if (!query.trim()) return [];
  // Garde d'auth : searchPlaces appelle l'API Places (payante) — on évite l'abus anonyme.
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  return getPlacesProvider().search(query, opts);
}

async function addPlace(category: "resto" | "hotel", formData: FormData) {
  const parsed = addRestoSchema.safeParse({ placeId: formData.get("placeId") });
  if (!parsed.success) return { error: "Place invalide" };
  // statut v2 optionnel (recherche externe : « le statut proposé suit le sous-onglet »)
  const statutV2 = formData.get("statutV2");
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  // Hôtels v2 : le mask équipements n'est demandé que pour les hôtels (coût SKU).
  const place = await getPlacesProvider().details(parsed.data.placeId, { hotel: category === "hotel" });
  if (!place) return { error: "Établissement introuvable" };
  const input = mapPlaceToEtablissement(place, category);
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", {
    p: { ...input, enriched_at: new Date().toISOString() },
  });
  if (rpcErr || !etabId) { logActionError("restos.searchPlaces", rpcErr); return { error: "Enregistrement échoué" }; }
  const extra =
    statutV2 === "favori" ? { is_favorite: true }
    : statutV2 === "teste" ? { statut: "visite" as const }
    : {};
  const { error: itemErr } = await supabase
    .from("liste_items")
    .upsert({ user_id: auth.user.id, etablissement_id: etabId, ...extra }, { onConflict: "user_id,etablissement_id" });
  if (itemErr) { logActionError("restos.searchPlaces", itemErr); return { error: "Ajout à la liste échoué" }; }
  revalidatePath(category === "hotel" ? "/hotels" : "/restos");
  return {};
}

export async function addResto(_prev: unknown, formData: FormData) {
  return addPlace("resto", formData);
}

export async function addHotel(_prev: unknown, formData: FormData) {
  return addPlace("hotel", formData);
}

export async function toggleFavorite(_prev: unknown, formData: FormData) {
  const parsed = toggleFavoriteSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    isFavorite: formData.get("isFavorite"),
  });
  if (!parsed.success) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase
    .from("liste_items")
    .update({ is_favorite: parsed.data.isFavorite })
    .eq("id", parsed.data.listeItemId);
  if (error) { logActionError("restos.toggleFavorite", error); return { error: "Mise à jour échouée" }; }
  // type "layout" : invalide aussi les fiches /restos/[id] et /hotels/[id] où le
  // toggle est rendu (une revalidation de liste seule laissait la fiche périmée).
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
  return {};
}

export async function toggleArchive(_prev: unknown, formData: FormData) {
  const parsed = toggleArchiveSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    isArchived: formData.get("isArchived"),
  });
  if (!parsed.success) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase
    .from("liste_items")
    .update({
      is_archived: parsed.data.isArchived,
      archived_at: parsed.data.isArchived ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.listeItemId);
  if (error) { logActionError("restos.toggleArchive", error); return { error: "Mise à jour échouée" }; }
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
  return {};
}

export async function addAvis(_prev: unknown, formData: FormData) {
  const parsed = addAvisSchema.safeParse({
    etablissementId: formData.get("etablissementId"),
    note: formData.get("note") || undefined,
    commentaire: formData.get("commentaire") || undefined,
    visiteLe: formData.get("visiteLe") || undefined,
  });
  if (!parsed.success) return { error: "Avis invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.from("avis").insert({
    user_id: auth.user.id,
    etablissement_id: parsed.data.etablissementId,
    note: parsed.data.note ?? null,
    commentaire: parsed.data.commentaire ?? null,
    visite_le: parsed.data.visiteLe ?? null,
  });
  if (error) { logActionError("restos.addAvis", error); return { error: "Avis non enregistré" }; }
  // AvisForm est rendu sur les fiches resto ET hôtel — on couvre les deux.
  revalidatePath(`/restos/${parsed.data.etablissementId}`);
  revalidatePath(`/hotels/${parsed.data.etablissementId}`);
  return {};
}

export async function setTags(_prev: unknown, formData: FormData) {
  const parsed = setTagsSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) return { error: "Tags invalides" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error: deleteErr } = await supabase
    .from("liste_item_tags")
    .delete()
    .eq("liste_item_id", parsed.data.listeItemId);
  if (deleteErr) { logActionError("restos.setTags", deleteErr); return { error: "Mise à jour des tags échouée" }; }
  if (parsed.data.tagIds.length > 0) {
    const rows = parsed.data.tagIds.map((tag_id) => ({ liste_item_id: parsed.data.listeItemId, tag_id }));
    const { error } = await supabase.from("liste_item_tags").insert(rows);
    if (error) { logActionError("restos.setTags", error); return { error: "Tags non enregistrés" }; }
  }
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
  return { ok: true as const };
}

// ── Restos v2 (Lot R-A) ─────────────────────────────────────────────────────

export async function marquerVisite(_prev: unknown, formData: FormData) {
  const parsed = marquerVisiteSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    note: formData.get("note") || undefined,
    commentaire: formData.get("commentaire") || undefined,
    visiteLe: formData.get("visiteLe") || undefined,
    passerEnFavori: formData.get("passerEnFavori") || undefined,
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) return { error: "Visite invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const d = parsed.data;
  const { error: vErr } = await supabase.from("visites").insert({
    user_id: auth.user.id,
    liste_item_id: d.listeItemId,
    note: d.note ?? null,
    commentaire: d.commentaire ?? null,
    ...(d.visiteLe ? { visite_le: d.visiteLe } : {}),
  });
  if (vErr) { logActionError("restos.marquerVisite", vErr); return { error: "Visite non enregistrée" }; }
  // L'item passe « testé » (statut='visite') ; « Passer en favori ? » du formulaire
  // pose is_favorite=true PAR-DESSUS (le statut stocké reste 'visite' — dérivation v2).
  const { error: sErr } = await supabase
    .from("liste_items")
    .update({ statut: "visite", ...(d.passerEnFavori ? { is_favorite: true } : {}) })
    .eq("id", d.listeItemId);
  if (sErr) { logActionError("restos.marquerVisite", sErr); return { error: "Statut non mis à jour" }; }
  // Tags de verdict : AJOUT aux tags de l'item (merge — pas le delete-all de setTags)
  if (d.tagIds && d.tagIds.length > 0) {
    const rows = d.tagIds.map((tag_id) => ({ liste_item_id: d.listeItemId, tag_id }));
    const { error: tErr } = await supabase
      .from("liste_item_tags")
      .upsert(rows, { onConflict: "liste_item_id,tag_id", ignoreDuplicates: true });
    if (tErr) { logActionError("restos.marquerVisite", tErr); return { error: "Tags non enregistrés" }; }
  }
  // Brique générique H0 : ces actions servent aussi les hôtels — les deux layouts.
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
  return { ok: true as const };
}

// ── Hôtels v2 (Lot H3) ──────────────────────────────────────────────────────

/** Séjour hôtel : visite avec plage de dates, voyage lié et occupation. */
export async function marquerSejour(_prev: unknown, formData: FormData) {
  const parsed = marquerSejourSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    note: formData.get("note") || undefined,
    commentaire: formData.get("commentaire") || undefined,
    visiteLe: formData.get("visiteLe") || undefined,
    dateFin: formData.get("dateFin") ?? "",
    voyageId: formData.get("voyageId") ?? "",
    adultes: formData.get("adultes") || undefined,
    enfants: formData.get("enfants") || undefined,
    chambres: formData.get("chambres") || undefined,
    passerEnFavori: formData.get("passerEnFavori") || undefined,
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) return { error: "Séjour invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const d = parsed.data;

  // La FK voyages ne garantit PAS l'accès (les FK ignorent la RLS) : SELECT sous
  // RLS (can_access_voyage) — un voyage étranger est simplement introuvable.
  let voyageId: string | null = null;
  if (d.voyageId) {
    const { data: voyage, error: vErr } = await supabase
      .from("voyages").select("id").eq("id", d.voyageId).maybeSingle();
    if (vErr) { logActionError("hotels.marquerSejour", vErr); return { error: "Séjour non enregistré" }; }
    if (!voyage) return { error: "Voyage introuvable" };
    voyageId = voyage.id;
  }

  const { error: sejErr } = await supabase.from("visites").insert({
    user_id: auth.user.id,
    liste_item_id: d.listeItemId,
    note: d.note ?? null,
    commentaire: d.commentaire ?? null,
    ...(d.visiteLe ? { visite_le: d.visiteLe } : {}),
    date_fin: d.dateFin || null,
    voyage_id: voyageId,
    adultes: d.adultes ?? null,
    enfants: d.enfants ?? null,
    chambres: d.chambres ?? null,
  });
  if (sejErr) { logActionError("hotels.marquerSejour", sejErr); return { error: "Séjour non enregistré" }; }

  const { error: stErr } = await supabase
    .from("liste_items")
    .update({ statut: "visite", ...(d.passerEnFavori ? { is_favorite: true } : {}) })
    .eq("id", d.listeItemId);
  if (stErr) { logActionError("hotels.marquerSejour", stErr); return { error: "Statut non mis à jour" }; }

  if (d.tagIds && d.tagIds.length > 0) {
    const rows = d.tagIds.map((tag_id) => ({ liste_item_id: d.listeItemId, tag_id }));
    const { error: tErr } = await supabase
      .from("liste_item_tags")
      .upsert(rows, { onConflict: "liste_item_id,tag_id", ignoreDuplicates: true });
    if (tErr) { logActionError("hotels.marquerSejour", tErr); return { error: "Tags non enregistrés" }; }
  }
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
  return { ok: true as const };
}

/** Infos hôtel perso (étoiles, prix/nuit, check-in/out) — sur liste_items. */
export async function setInfosHotel(_prev: unknown, formData: FormData) {
  const parsed = setInfosHotelSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    etoiles: formData.get("etoiles") || undefined,
    prixNuit: formData.get("prixNuit") || undefined,
    checkinHeure: formData.get("checkinHeure") ?? "",
    checkoutHeure: formData.get("checkoutHeure") ?? "",
  });
  if (!parsed.success) return { error: "Informations invalides" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const d = parsed.data;
  const { error } = await supabase
    .from("liste_items")
    .update({
      etoiles: d.etoiles ?? null,
      prix_nuit: d.prixNuit ?? null,
      checkin_heure: d.checkinHeure || null,
      checkout_heure: d.checkoutHeure || null,
    })
    .eq("id", d.listeItemId);
  if (error) { logActionError("hotels.setInfosHotel", error); return { error: "Enregistrement échoué" }; }
  revalidatePath("/hotels", "layout");
  return { ok: true as const };
}

export async function changerStatut(_prev: unknown, formData: FormData) {
  const parsed = changerStatutSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    statut: formData.get("statut"),
  });
  if (!parsed.success) return { error: "Statut invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  // favori → is_favorite=true SANS toucher au statut stocké (visites conservées) ;
  // a_tester / teste → retire le favori et pose le statut correspondant.
  const values =
    parsed.data.statut === "favori" ? { is_favorite: true }
    : parsed.data.statut === "teste" ? { is_favorite: false, statut: "visite" as const }
    : { is_favorite: false, statut: "a_faire" as const };
  const { error } = await supabase.from("liste_items").update(values).eq("id", parsed.data.listeItemId);
  if (error) { logActionError("restos.changerStatut", error); return { error: "Mise à jour échouée" }; }
  // Brique générique H0 : ces actions servent aussi les hôtels — les deux layouts.
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
  return { ok: true as const };
}

export async function setOrigine(_prev: unknown, formData: FormData) {
  const parsed = setOrigineSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    origineType: formData.get("origineType"),
    origineQui: formData.get("origineQui") ?? "",
    origineFamilyMemberId: formData.get("origineFamilyMemberId") ?? "",
    origineSource: formData.get("origineSource") ?? "",
  });
  if (!parsed.success) return { error: "Origine invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const d = parsed.data;
  let origineQui = d.origineQui || null;
  let fmId: string | null = null;
  if (d.origineType === "reco" && d.origineFamilyMemberId) {
    // La FK ne vérifie pas l'ownership : SELECT sous RLS (owner-only) — un
    // family_member étranger est simplement introuvable.
    const { data: fm, error: fmErr } = await supabase
      .from("family_members")
      .select("id, first_name, last_name")
      .eq("id", d.origineFamilyMemberId)
      .maybeSingle();
    if (fmErr) { logActionError("restos.setOrigine", fmErr); return { error: "Origine non enregistrée" }; }
    if (!fm) return { error: "Proche introuvable" };
    fmId = fm.id;
    origineQui = origineQui ?? `${fm.first_name} ${fm.last_name}`;
  }
  const { error } = await supabase
    .from("liste_items")
    .update({
      origine_type: d.origineType,
      origine_qui: d.origineType === "reco" ? origineQui : null,
      origine_family_member_id: d.origineType === "reco" ? fmId : null,
      origine_source: d.origineType === "trouve" ? (d.origineSource || null) : null,
    })
    .eq("id", d.listeItemId);
  if (error) { logActionError("restos.setOrigine", error); return { error: "Origine non enregistrée" }; }
  // Brique générique H0 : ces actions servent aussi les hôtels — les deux layouts.
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
  return { ok: true as const };
}

export async function cacheEtablissementPhoto(etabId: string, photoRef: string) {
  if (!photoRef) return;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.rpc("cache_etablissement_photo", { p_etab: etabId, p_ref: photoRef });
}
