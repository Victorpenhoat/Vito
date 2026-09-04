"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { ajouterAuCarnet } from "@/features/places/data/ajouterAuCarnet";

async function userId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Recommander une adresse à un proche. Tout le contrôle est dans la RPC : elle
 * seule sait si le destinataire est bien un proche À MOI avec un compte. Il n'y
 * a volontairement aucune écriture directe dans `recommandations`.
 */
export async function recommanderAdresse(_prev: unknown, formData: FormData) {
  const familyMemberId = formData.get("familyMemberId");
  const categorie = formData.get("categorie");
  const placeId = formData.get("placeId");
  const libelle = formData.get("libelle");
  const mot = formData.get("mot");
  if (typeof familyMemberId !== "string" || typeof placeId !== "string" || typeof libelle !== "string") {
    return { error: "Entrée invalide" };
  }
  if (categorie !== "resto" && categorie !== "hotel") return { error: "Entrée invalide" };

  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase.rpc("recommander_adresse", {
    p_family_member_id: familyMemberId,
    p_categorie: categorie,
    p_place_id: placeId,
    p_libelle: libelle,
    p_mot: typeof mot === "string" && mot.trim() ? mot.trim() : undefined,
  });
  if (error) { logActionError("reception.recommander", error); return { error: "Envoi impossible" }; }
  const res = data as { ok?: boolean; motif?: string } | null;
  if (!res?.ok) {
    // « destinataire_invalide » recouvre « pas mon proche » ET « sans compte » :
    // la RPC ne distingue pas les deux, l'écran non plus.
    return { error: res?.motif === "destinataire_invalide" ? "Ce proche ne peut rien recevoir" : "Envoi impossible" };
  }
  return { ok: true as const };
}

/**
 * Accepter : l'adresse entre au carnet en « À tester », avec l'origine
 * « recommandé par … » déjà remplie — exactement ce que la saisie manuelle
 * produisait, sans la saisie.
 */
export async function accepterRecommandation(_prev: unknown, formData: FormData) {
  const id = formData.get("recommandationId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };

  // Relecture SOUS RLS : elle vérifie du même coup que la recommandation
  // m'est bien adressée, et qu'elle attend encore.
  const { data: reco } = await supabase
    .from("recommandations")
    .select("id, de_profile_id, categorie, place_id")
    .eq("id", id).eq("statut", "en_attente").maybeSingle();
  if (!reco) return { error: "Recommandation introuvable" };

  // L'expéditeur est-il dans MON Cercle ? Si oui, l'origine porte le lien vers
  // sa fiche ; sinon, son nom suffit (le lien n'est pas symétrique).
  const { data: proche } = await supabase
    .from("family_members")
    .select("id, first_name, last_name")
    .eq("profile_id", reco.de_profile_id)
    .maybeSingle();
  const { data: profil } = await supabase
    .from("profiles").select("display_name, first_name").eq("id", reco.de_profile_id).maybeSingle();
  const nom = proche
    ? `${proche.first_name} ${proche.last_name}`.trim()
    : (profil?.display_name ?? profil?.first_name ?? "");

  const ajout = await ajouterAuCarnet(supabase, uid, reco.place_id,
    reco.categorie === "hotel" ? "hotel" : "resto",
    { origine: { type: "reco", qui: nom || null, familyMemberId: proche?.id ?? null } });
  if ("error" in ajout) { logActionError("reception.accepter", ajout.error); return { error: ajout.error }; }

  const { error } = await supabase
    .from("recommandations")
    .update({ statut: "acceptee", traitee_le: new Date().toISOString() })
    .eq("id", id);
  if (error) { logActionError("reception.accepter", error); return { error: "Traitement échoué" }; }

  revalidatePath("/reception");
  revalidatePath(reco.categorie === "hotel" ? "/hotels" : "/restos", "layout");
  return { ok: true as const, etablissementId: ajout.etablissementId };
}

/**
 * Refuser : la ligne quitte la boîte. L'expéditeur n'en saura rien — décision
 * PO, on ne froisse personne.
 */
export async function refuserRecommandation(_prev: unknown, formData: FormData) {
  const id = formData.get("recommandationId");
  if (typeof id !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { data, error } = await supabase
    .from("recommandations")
    .update({ statut: "refusee", traitee_le: new Date().toISOString() })
    .eq("id", id).eq("statut", "en_attente")
    .select("id").maybeSingle();
  if (error) { logActionError("reception.refuser", error); return { error: "Traitement échoué" }; }
  if (!data) return { error: "Recommandation introuvable" };
  revalidatePath("/reception");
  return { ok: true as const };
}
