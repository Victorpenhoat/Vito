"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { logActionError } from "@/lib/actionError";
import { ZONES } from "../domain/zoneScolaire";

/**
 * Enregistre la zone choisie. Elle l'emporte définitivement sur la déduction :
 * déménager ne doit pas changer sa zone dans le dos de l'utilisateur.
 */
export async function enregistrerZoneScolaire(_prev: unknown, formData: FormData) {
  const zone = String(formData.get("zone") ?? "");
  // Le vocabulaire vient de la source : une valeur hors liste ne correspondrait
  // à aucune ligne du calendrier, et n'a pu venir que d'un formulaire trafiqué.
  if (!(ZONES as readonly string[]).includes(zone)) return { error: "Zone inconnue" };

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Non authentifié" };

  const { error } = await supabase.from("profiles").update({ zone_scolaire: zone }).eq("id", data.user.id);
  if (error) {
    logActionError("zone_scolaire.update", error);
    return { error: "Enregistrement impossible" };
  }
  revalidatePath("/voyages/planning");
  return { ok: true as const };
}
