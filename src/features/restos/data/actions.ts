"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "../domain/mapPlaceToEtablissement";
import {
  addRestoSchema, addAvisSchema, setTagsSchema, toggleFavoriteSchema,
} from "../domain/schemas";

export async function searchPlaces(query: string) {
  if (!query.trim()) return [];
  // Garde d'auth : searchPlaces appelle l'API Places (payante) — on évite l'abus anonyme.
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  return getPlacesProvider().search(query);
}

export async function addResto(_prev: unknown, formData: FormData) {
  const parsed = addRestoSchema.safeParse({ placeId: formData.get("placeId") });
  if (!parsed.success) return { error: "Place invalide" };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  const place = await getPlacesProvider().details(parsed.data.placeId);
  if (!place) return { error: "Établissement introuvable" };

  const input = mapPlaceToEtablissement(place);
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", {
    p: { ...input, enriched_at: new Date().toISOString() },
  });
  if (rpcErr || !etabId) return { error: "Enregistrement échoué" };

  const { error: itemErr } = await supabase
    .from("liste_items")
    .upsert({ user_id: auth.user.id, etablissement_id: etabId }, { onConflict: "user_id,etablissement_id" });
  if (itemErr) return { error: "Ajout à la liste échoué" };

  revalidatePath("/restos");
  return {};
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
  if (error) return { error: "Mise à jour échouée" };
  revalidatePath("/restos");
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
  if (error) return { error: "Avis non enregistré" };
  revalidatePath(`/restos/${parsed.data.etablissementId}`);
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
  if (deleteErr) return { error: "Mise à jour des tags échouée" };
  if (parsed.data.tagIds.length > 0) {
    const rows = parsed.data.tagIds.map((tag_id) => ({ liste_item_id: parsed.data.listeItemId, tag_id }));
    const { error } = await supabase.from("liste_item_tags").insert(rows);
    if (error) return { error: "Tags non enregistrés" };
  }
  revalidatePath("/restos");
  return {};
}
