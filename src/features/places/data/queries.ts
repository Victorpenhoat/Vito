import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import type { Place } from "../domain/filterPlaces";
import type { ReservationHebergement } from "../domain/sejourAVenir";

const SELECT =
  "id, statut, is_favorite, reco_source, origine_type, origine_qui, origine_source, etoiles, prix_nuit, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref, lat, lng, place_id, rating, rating_count, type_hebergement, equipements), tags:liste_item_tags(tag:tags(slug, label, color)), visites(note, visite_le, date_fin)";

async function queryPlaces(category: "resto" | "hotel", archived: boolean): Promise<Place[]> {
  const supabase = await createServerSupabase();
  // Fail-safe anon : layout et page rendent en parallèle (App Router), donc le
  // requireRole du layout ne garde pas cette requête. Sans session, liste_items
  // renvoie 42501 (anon) et crashe le RSC ; on court-circuite (cf. accueil/reco).
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("liste_items")
    .select(SELECT)
    .eq("etablissement.categorie", category)
    .eq("is_archived", archived)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const visites = (row.visites ?? []) as { note: number | null; visite_le: string; date_fin: string | null }[];
    const derniere = visites.length
      ? visites.reduce((a, b) => (a.visite_le >= b.visite_le ? a : b))
      : null;
    return {
      id: row.id,
      statut: row.statut,
      is_favorite: row.is_favorite,
      etoiles: row.etoiles,
      prix_nuit: row.prix_nuit,
      // v2 : origine_qui prime ; reco_source conservé en repli (déprécié, backfillé en 00030)
      reco_source: row.origine_qui ?? row.reco_source,
      origine_type: row.origine_type,
      origine_qui: row.origine_qui,
      origine_source: row.origine_source,
      derniere_visite: derniere,
      etablissement: Array.isArray(row.etablissement) ? row.etablissement[0]! : row.etablissement,
      tags: (row.tags ?? []).flatMap((t) => {
        const tag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
        return tag ? [tag] : [];
      }),
    };
  }) as Place[];
}

export function getPlaces(category: "resto" | "hotel"): Promise<Place[]> {
  return queryPlaces(category, false);
}

export function getArchivedPlaces(category: "resto" | "hotel"): Promise<Place[]> {
  return queryPlaces(category, true);
}

// ── Réservations d'hébergement (Lot H6) ─────────────────────────────────────

/**
 * Les réservations de voyage qui désignent cet hébergement. La RLS des
 * réservations (`can_access_voyage`) fait le tri : seules celles des voyages
 * auxquels j'ai accès reviennent, sans garde applicative supplémentaire.
 */
export async function getReservationsHebergement(etablissementId: string): Promise<ReservationHebergement[]> {
  const supabase = await createServerSupabase();
  // Fail-safe anon (cf. #61/#63)
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("reservations")
    .select("id, date_debut, date_fin, voyage:voyages(id, titre)")
    .eq("etablissement_id", etablissementId)
    .order("date_debut", { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).flatMap((r) => {
    const voyage = Array.isArray(r.voyage) ? r.voyage[0] : r.voyage;
    if (!voyage) return [];
    return [{
      id: r.id,
      voyageId: voyage.id,
      voyageTitre: voyage.titre,
      dateDebut: r.date_debut,
      dateFin: r.date_fin,
    }];
  });
}
