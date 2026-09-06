"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getTauxProvider } from "@/lib/services/taux-change";
import { estDeviseConnue } from "../domain/devises";

/**
 * Le taux du jour de la dépense, pour proposer une conversion à la saisie.
 *
 * Le résultat n'est qu'une PROPOSITION : c'est le taux de référence de la BCE,
 * pas celui de ta banque, et l'écran laisse le corriger. `null` quand on ne
 * sait pas — aucun taux inventé ne part d'ici.
 */
export async function tauxDeChange(deviseSaisie: string, deviseVoyage: string, date: string) {
  // Garde d'authentification sur une lecture (PR #61/#63) : cette action sort
  // sur le réseau, elle n'est pas offerte aux visiteurs.
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  if (!estDeviseConnue(deviseSaisie) || !estDeviseConnue(deviseVoyage)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return getTauxProvider().taux(deviseSaisie, deviseVoyage, date);
}
