import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "@/features/restos/domain/mapPlaceToEtablissement";

// Entrée d'un établissement dans le carnet, partagée par la recherche externe
// (addResto / addHotel) et par les réservations de voyage (lot H6). Ce module
// n'est PAS un fichier d'actions : il ne doit exposer aucun point d'entrée
// réseau, seulement la mécanique commune.

type Origine = {
  type: "voyage" | "reco";
  qui: string | null;
  /** Proche du Cercle à l'origine (recommandation acceptée) : le lien vaut
   *  mieux que le nom, il survit à un changement d'orthographe. */
  familyMemberId?: string | null;
};

/**
 * Crée (ou retrouve) l'établissement chez le fournisseur, puis l'ajoute à la
 * liste de l'utilisateur. Renvoie l'id de l'établissement, ou une erreur
 * lisible par l'appelant.
 *
 * L'upsert sur (user_id, etablissement_id) rend l'opération idempotente : un
 * hôtel déjà au carnet n'est pas dupliqué et ne perd ni son statut ni ses tags.
 */
export async function ajouterAuCarnet(
  supabase: SupabaseClient,
  userId: string,
  placeId: string,
  categorie: "resto" | "hotel",
  opts: { statutV2?: string | null; origine?: Origine } = {},
): Promise<{ etablissementId: string } | { error: string }> {
  // L'établissement est-il DÉJÀ connu de la base ? Alors inutile de redemander
  // ses détails au fournisseur : il a été enrichi à sa création, l'appel serait
  // payant pour rien — et surtout, il échouerait pour tout établissement que le
  // fournisseur ne connaît pas (import, saisie, jeu de démonstration), ce qui
  // rendait une recommandation impossible à accepter.
  const { data: connu } = await supabase
    .from("etablissements").select("id").eq("place_id", placeId).maybeSingle();

  let etablissementId = connu?.id as string | undefined;
  if (!etablissementId) {
    // Le mask équipements n'est demandé que pour les hôtels (coût SKU).
    const place = await getPlacesProvider().details(placeId, { hotel: categorie === "hotel" });
    if (!place) return { error: "Établissement introuvable" };
    const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", {
      p: { ...mapPlaceToEtablissement(place, categorie), enriched_at: new Date().toISOString() },
    });
    if (rpcErr || !etabId) return { error: "Enregistrement échoué" };
    etablissementId = etabId as string;
  }

  const statut =
    opts.statutV2 === "favori" ? { is_favorite: true }
    : opts.statutV2 === "teste" ? { statut: "visite" as const }
    : {};
  // L'origine n'est posée qu'à la CRÉATION : réserver deux fois le même hôtel
  // ne doit pas écraser la raison pour laquelle il est entré au carnet.
  const origine = opts.origine
    ? {
        origine_type: opts.origine.type,
        origine_qui: opts.origine.qui,
        ...(opts.origine.familyMemberId
          ? { origine_family_member_id: opts.origine.familyMemberId }
          : {}),
      }
    : {};

  const { error: itemErr } = await supabase
    .from("liste_items")
    .upsert(
      { user_id: userId, etablissement_id: etablissementId, ...statut, ...origine },
      { onConflict: "user_id,etablissement_id", ignoreDuplicates: opts.origine != null },
    );
  if (itemErr) return { error: "Ajout à la liste échoué" };

  return { etablissementId };
}
