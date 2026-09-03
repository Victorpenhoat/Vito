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

// ── Appareils et sessions (Onboarding lot O-E, écrans 14 et 15) ─────────────

/** Révoque une session : l'appareil visé retombe sur l'écran de connexion. */
export async function revoquerSession(_prev: unknown, formData: FormData) {
  const id = formData.get("sessionId");
  if (typeof id !== "string" || id === "") return { error: "Session inconnue" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  // La fonction refuse la session courante (on ne se déconnecte pas soi-même
  // par mégarde) et n'agit que sur les sessions de l'appelant.
  const { data, error } = await supabase.rpc("revoquer_session", { p_session_id: id });
  if (error) { logActionError("compte.revoquerSession", error); return { error: "Révocation échouée" }; }
  if (data !== true) return { error: "Révocation impossible" };
  revalidatePath("/reglages");
  return { ok: true as const };
}

/** « Déconnecter tous les autres appareils » — la session courante est conservée. */
export async function revoquerAutresSessions() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.rpc("revoquer_autres_sessions");
  if (error) { logActionError("compte.revoquerAutresSessions", error); return { error: "Révocation échouée" }; }
  revalidatePath("/reglages");
  return { ok: true as const };
}
