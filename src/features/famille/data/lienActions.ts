"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { RELATIONS, type Relation } from "../domain/schemas";
import { DUREE_CODE_MINUTES, genererCode, normaliserCode } from "../domain/lienCompte";

/**
 * Lier deux comptes qui existent déjà (migration 00067).
 *
 * L'invitation de `actions.ts` fait CRÉER un compte au proche ; ici les deux
 * personnes en ont un et cherchent seulement à se reconnaître. Le secret
 * échangé est court parce qu'il se dicte ou se scanne — il ne vit donc qu'un
 * quart d'heure, ne sert qu'une fois, et la base plafonne les tentatives.
 */
const ESSAIS_CODE = 5;

const MOTIFS: Record<string, string> = {
  invalide: "Ce code n'est plus valable",
  soi_meme: "Ce code est le vôtre",
  trop_de_tentatives: "Trop d'essais : réessayez dans dix minutes",
  relation_invalide: "Relation invalide",
  non_authentifie: "Non authentifié",
};

/** « moi » est sa propre fiche : elle ne peut désigner personne d'autre. */
function relationValide(v: FormDataEntryValue | null): v is Relation {
  return typeof v === "string" && v !== "moi" && (RELATIONS as readonly string[]).includes(v);
}

export async function creerCodeLien(_prev: unknown, formData: FormData) {
  const relation = formData.get("relation");
  if (!relationValide(relation)) return { error: "Relation invalide" };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { error: "Non authentifié" };

  // Fiche déjà au carnet : on la relit SOUS RLS, ce qui vérifie du même coup
  // qu'elle est bien à moi (la FK, elle, ne garantit aucun accès).
  const familyMemberId = formData.get("familyMemberId");
  let cible: string | null = null;
  if (typeof familyMemberId === "string" && familyMemberId) {
    const { data: proche } = await supabase
      .from("family_members").select("id, profile_id").eq("id", familyMemberId).maybeSingle();
    if (!proche) return { error: "Proche introuvable" };
    if (proche.profile_id) return { error: "Ce proche a déjà un compte" };
    cible = proche.id;
  }

  const expireLe = new Date(Date.now() + DUREE_CODE_MINUTES * 60_000).toISOString();
  // L'unicité du code est tenue par un index : en cas de collision, on retire.
  for (let essai = 0; essai < ESSAIS_CODE; essai++) {
    const code = genererCode();
    const { error } = await supabase.from("invitations").insert({
      token: randomBytes(32).toString("base64url"),
      code,
      relation,
      role_vise: "cercle",
      family_member_id: cible,
      cree_par: uid,
      expire_le: expireLe,
    }).select("id").single();

    if (!error) {
      revalidatePath("/famille", "layout");
      return { ok: true as const, code, expireLe };
    }
    if ((error as { code?: string }).code !== "23505") {
      logActionError("famille.creerCodeLien", error);
      return { error: "Code non créé" };
    }
  }
  return { error: "Code non créé" };
}

export type LienInfos =
  | { valide: false }
  | { valide: true; invite_par: string; relation_proposee: Relation | null; soi_meme: boolean };

/** Ce que voit celui qui reçoit le code, avant d'accepter. */
export async function lireLien(saisie: string): Promise<LienInfos> {
  const code = normaliserCode(saisie);
  if (!code) return { valide: false };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("lien_infos", { p_code: code });
  if (error) {
    logActionError("famille.lireLien", error);
    return { valide: false };
  }
  return (data as LienInfos | null) ?? { valide: false };
}

export async function lierAvecCode(_prev: unknown, formData: FormData) {
  const code = normaliserCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "Code invalide" };
  const relation = formData.get("relation");
  if (!relationValide(relation)) return { error: "Relation invalide" };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  const { data, error } = await supabase.rpc("lier_comptes", { p_code: code, p_relation: relation });
  if (error) {
    logActionError("famille.lierAvecCode", error);
    return { error: "Liaison échouée" };
  }
  const res = data as { ok?: boolean; motif?: string } | null;
  if (!res?.ok) return { error: MOTIFS[res?.motif ?? ""] ?? "Liaison échouée" };

  revalidatePath("/famille", "layout");
  return { ok: true as const };
}
