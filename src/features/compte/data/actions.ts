"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { displayNameDepuis, preferencesVerrouSchema, profilSchema } from "../domain/schemas";
import { verifierMotDePasse } from "@/lib/auth/motDePasse";

export async function updateProfil(_prev: unknown, formData: FormData) {
  const parsed = profilSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) return { error: "Profil invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { firstName, lastName } = parsed.data;
  // La policy profiles_update_self limite déjà l'écriture à sa propre ligne, et
  // le trigger profiles_role_immutable interdit tout changement de rôle ici.
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName || null,
      display_name: displayNameDepuis(firstName, lastName),
    })
    .eq("id", auth.user.id);
  if (error) { logActionError("compte.updateProfil", error); return { error: "Enregistrement échoué" }; }
  // "layout" : le nom s'affiche dans le shell de toutes les pages.
  revalidatePath("/", "layout");
  return { ok: true as const };
}

// ── Verrouillage de l'application (Onboarding lot O-D, écrans 6 et 10) ──────

/**
 * Déverrouille l'application après vérification du mot de passe.
 *
 * ⚠ Le verrou est une protection d'AFFICHAGE : il empêche qu'un carnet resté
 * ouvert soit lu par un tiers. Il ne remplace pas les gardes serveur — les
 * données protégées (numéros, scans) exigent, elles, une vérification propre
 * à chaque révélation.
 */
export async function deverrouillerApp(_prev: unknown, formData: FormData) {
  const motDePasse = formData.get("motDePasse");
  if (typeof motDePasse !== "string" || motDePasse === "") return { error: "Déverrouillage impossible" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: "Non authentifié" };
  if (!(await verifierMotDePasse(auth.user.email, motDePasse))) {
    return { error: "Déverrouillage impossible" };
  }
  return { ok: true as const };
}

/** Préférences de verrouillage (Réglages > Sécurité). */
export async function setPreferencesVerrou(_prev: unknown, formData: FormData) {
  const parsed = preferencesVerrouSchema.safeParse({
    delaiMinutes: formData.get("delaiMinutes"),
  });
  if (!parsed.success) return { error: "Préférence invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase
    .from("profiles")
    .update({ verrou_delai_minutes: parsed.data.delaiMinutes })
    .eq("id", auth.user.id);
  if (error) { logActionError("compte.setPreferencesVerrou", error); return { error: "Enregistrement échoué" }; }
  revalidatePath("/", "layout");
  return { ok: true as const };
}
