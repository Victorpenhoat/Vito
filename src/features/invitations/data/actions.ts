"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { creerCompteSchema, inviterSchema } from "../domain/schemas";
import { displayNameDepuis } from "@/features/compte/domain/schemas";

/** Informations publiques d'une invitation (écran d'accueil de l'invité). */
export async function lireInvitation(token: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("invitation_infos", { p_token: token });
  if (error) { logActionError("invitations.lireInvitation", error); return { valide: false as const }; }
  return (data ?? { valide: false }) as {
    valide: boolean; role_vise?: string; invite_par?: string; email_indice?: string | null;
    email_impose?: boolean; voyage_titre?: string | null; voyage_destination?: string | null;
    voyage_date_debut?: string | null; voyage_date_fin?: string | null;
  };
}

/**
 * Crée le compte porté par une invitation.
 * L'inscription publique est désactivée côté Supabase : la seule voie est ici,
 * après validation du jeton, via l'Admin API. Impossible de contourner l'app.
 */
export async function creerCompteAvecInvitation(_prev: unknown, formData: FormData) {
  const t = await getTranslations("auth.errors");
  const parsed = creerCompteSchema.safeParse({
    token: formData.get("token"),
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
    conditions: formData.get("conditions"),
  });
  if (!parsed.success) return { error: t("saisieInvalide") };
  const d = parsed.data;

  // 1. Le jeton doit être valide AVANT toute création.
  const supabase = await createServerSupabase();
  const { data: infos } = await supabase.rpc("invitation_infos", { p_token: d.token });
  const invitation = (infos ?? { valide: false }) as { valide: boolean; email_impose?: boolean };
  if (!invitation.valide) return { error: t("invitationInvalide") };

  // 2. Création par l'Admin API (email confirmé : l'invitation fait foi).
  const admin = createAdminClient();
  const { data: cree, error: creationErr } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { display_name: displayNameDepuis(d.firstName, d.lastName) },
  });
  if (creationErr || !cree.user) {
    // Adresse déjà prise, jeton nominatif non respecté… message neutre.
    logActionError("invitations.creerCompte", creationErr);
    return { error: t("creationImpossible") };
  }

  // 3. Session immédiate, puis consommation du jeton sous l'identité du nouveau
  //    compte (la RPC vérifie que l'adresse correspond si l'invitation est nominative).
  const { error: sessionErr } = await supabase.auth.signInWithPassword({
    email: d.email, password: d.password,
  });
  if (sessionErr) { logActionError("invitations.creerCompte", sessionErr); return { error: t("creationImpossible") }; }

  const { data: conso } = await supabase.rpc("consommer_invitation", { p_token: d.token });
  const resultat = (conso ?? { ok: false }) as { ok: boolean };
  if (!resultat.ok) {
    // Le compte existe mais l'invitation n'a pas pu être consommée : on ne
    // laisse pas l'utilisateur dans un état ambigu.
    await supabase.auth.signOut();
    return { error: t("invitationInvalide") };
  }

  // 4. Profil + acceptation des conditions.
  const { error: profilErr } = await supabase
    .from("profiles")
    .update({
      first_name: d.firstName,
      last_name: d.lastName || null,
      display_name: displayNameDepuis(d.firstName, d.lastName),
      conditions_acceptees_le: new Date().toISOString(),
    })
    .eq("id", cree.user.id);
  if (profilErr) logActionError("invitations.creerCompte", profilErr);

  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: "/bienvenue", locale });
}

/** Émet une invitation (réglages > Partages). Le jeton n'est montré qu'ici. */
export async function creerInvitation(_prev: unknown, formData: FormData) {
  const parsed = inviterSchema.safeParse({
    email: formData.get("email") ?? "",
    roleVise: formData.get("roleVise") ?? "membre",
    voyageId: formData.get("voyageId") ?? "",
  });
  if (!parsed.success) return { error: "Invitation invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  // 32 octets en base64url : assez long pour n'être pas devinable.
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("invitations").insert({
    token,
    email: parsed.data.email || null,
    role_vise: parsed.data.roleVise,
    voyage_id: parsed.data.voyageId || null,
    cree_par: auth.user.id,
  });
  if (error) { logActionError("invitations.creerInvitation", error); return { error: "Invitation non créée" }; }
  revalidatePath("/reglages");
  return { ok: true as const, token };
}
