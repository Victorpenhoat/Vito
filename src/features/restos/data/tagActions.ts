"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { creerTagSchema, updateTagSchema, fusionnerTagsSchema, supprimerTagSchema } from "../domain/schemas";
import { tagSlug } from "../domain/tagSlug";

// Tags v2 (Lot R-B) : tags personnels administrables — les tags système
// (user_id null) sont protégés par la RLS (update/delete → 0 ligne).

function revalidate() {
  revalidatePath("/restos", "layout");
  revalidatePath("/hotels", "layout");
}

export async function creerTag(_prev: unknown, formData: FormData) {
  const parsed = creerTagSchema.safeParse({
    label: formData.get("label"),
    scope: formData.get("scope") ?? "restaurant",
    color: formData.get("color") ?? "",
  });
  if (!parsed.success) return { error: "Tag invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("tags")
    .insert({
      user_id: auth.user.id,
      slug: tagSlug(parsed.data.label),
      label: parsed.data.label,
      scope: parsed.data.scope,
      color: parsed.data.color || null,
      categorie: "ambiance",
      is_system: false,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { error: "Un tag avec ce nom existe déjà" };
    logActionError("restos.creerTag", error);
    return { error: "Création échouée" };
  }
  revalidate();
  return { ok: true as const, tagId: data.id };
}

export async function updateTag(_prev: unknown, formData: FormData) {
  const parsed = updateTagSchema.safeParse({
    tagId: formData.get("tagId"),
    label: formData.get("label"),
    scope: formData.get("scope"),
    color: formData.get("color") ?? "",
  });
  if (!parsed.success) return { error: "Tag invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  // RLS update = tags persos uniquement : un tag système renvoie 0 ligne.
  const { data, error } = await supabase
    .from("tags")
    .update({
      label: parsed.data.label,
      slug: tagSlug(parsed.data.label),
      scope: parsed.data.scope,
      color: parsed.data.color || null,
    })
    .eq("id", parsed.data.tagId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { error: "Un tag avec ce nom existe déjà" };
    logActionError("restos.updateTag", error);
    return { error: "Modification échouée" };
  }
  if (!data) return { error: "Tag système ou introuvable — non modifiable" };
  revalidate();
  return { ok: true as const };
}

export async function fusionnerTags(_prev: unknown, formData: FormData) {
  const parsed = fusionnerTagsSchema.safeParse({
    sourceId: formData.get("sourceId"),
    cibleId: formData.get("cibleId"),
  });
  if (!parsed.success) return { error: "Fusion invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("fusionner_tags", {
    p_source: parsed.data.sourceId,
    p_cible: parsed.data.cibleId,
  });
  if (error) { logActionError("restos.fusionnerTags", error); return { error: "Fusion échouée" }; }
  revalidate();
  return { ok: true as const };
}

export async function supprimerTag(_prev: unknown, formData: FormData) {
  const parsed = supprimerTagSchema.safeParse({ tagId: formData.get("tagId") });
  if (!parsed.success) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  // liste_item_tags : cascade DB. RLS delete = persos uniquement (système → 0 ligne).
  const { data, error } = await supabase
    .from("tags")
    .delete()
    .eq("id", parsed.data.tagId)
    .select("id")
    .maybeSingle();
  if (error) { logActionError("restos.supprimerTag", error); return { error: "Suppression échouée" }; }
  if (!data) return { error: "Tag système ou introuvable — non supprimable" };
  revalidate();
  return { ok: true as const };
}
