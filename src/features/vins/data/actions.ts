"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEnrichmentProvider } from "@/lib/services/enrichment";
import { degustationInputSchema } from "../domain/schemas";

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
