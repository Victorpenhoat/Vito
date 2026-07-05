"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { voyageInputSchema } from "@/features/voyages/domain/schemas";
import { lierClientSchema } from "../domain/schemas";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function lierClient(_prev: unknown, formData: FormData) {
  const parsed = lierClientSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "E-mail invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.rpc("lier_client", { p_email: parsed.data.email });
  if (error) { logActionError("agence.lierClient", error); return { error: "Liaison échouée" }; }
  if (data === "not_found") return { error: "Aucun utilisateur avec cet e-mail" };
  if (data === "self") return { error: "Vous ne pouvez pas vous lier vous-même" };
  revalidatePath("/agence");
  return { ok: true as const };
}

export async function delierClient(_prev: unknown, formData: FormData) {
  const clientId = formData.get("clientId");
  if (typeof clientId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("delier_client", { p_client_id: clientId });
  if (error) { logActionError("agence.delierClient", error); return { error: "Retrait échoué" }; }
  revalidatePath("/agence");
  return { ok: true as const };
}

export async function creerVoyagePourClient(_prev: unknown, formData: FormData) {
  const clientId = formData.get("clientId");
  if (typeof clientId !== "string") return { error: "Entrée invalide" };
  const parsed = voyageInputSchema.safeParse({
    titre: formData.get("titre"),
    destination: formData.get("destination") || undefined,
    dateDebut: formData.get("dateDebut") || undefined,
    dateFin: formData.get("dateFin") || undefined,
    statut: formData.get("statut") || undefined,
  });
  if (!parsed.success) return { error: "Voyage invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const d = parsed.data;
  const { error } = await supabase.rpc("creer_voyage_pour_client", {
    p_client_id: clientId,
    p_titre: d.titre,
    p_destination: d.destination ?? "",
    p_date_debut: (d.dateDebut ?? null) as string,
    p_date_fin: (d.dateFin ?? null) as string,
    p_statut: d.statut ?? "planifie",
  });
  if (error) {
    if (error.message?.includes("client non lié")) return { error: "Ce client n'est pas dans votre portefeuille" };
    if (error.message?.includes("limite_voyages_free")) return { error: "Le client a atteint sa limite Free" };
    if (error.message?.includes("réservé aux agences")) return { error: "Réservé aux agences" };
    logActionError("agence.creerVoyagePourClient", error);
    return { error: "Création échouée" };
  }
  revalidatePath("/agence");
  revalidatePath("/voyages");
  return { ok: true as const };
}
