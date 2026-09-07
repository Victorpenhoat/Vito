import { cache } from "react";
import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import { prochaineOccurrence, seancesRestantes, type Creneau, type Occurrence } from "../domain/activite";

export type MembreActivite = {
  id: string;
  prenom: string;
  couleur: string | null;
  /** Le membre qui est le compte lui-même — épinglé en fin de liste. */
  estMoi: boolean;
};

export type ActiviteListe = {
  id: string;
  type: string;
  nom: string;
  statut: string;
  clubNom: string | null;
  adresse: string | null;
  /** Le club, pour l'appel direct depuis la liste. */
  telephone: string | null;
  lat: number | null;
  lng: number | null;
  membres: MembreActivite[];
  creneaux: Creneau[];
  /** Tags du carnet (système ou personnels), pour le filtre « Tags ▾ ». */
  tags: { slug: string; label: string }[];
  /** Intervenants des créneaux : la recherche du design les couvre. */
  intervenants: string[];
  /** Calculée au serveur : la liste ne fait qu'afficher. */
  prochaine: Occurrence | null;
  /** null pour un abonnement illimité — il n'y a alors rien à décompter. */
  restantes: number | null;
};

/**
 * Les activités du compte, avec leurs membres et leurs créneaux.
 *
 * UNE requête, imbriquée : la liste montre déjà les membres et la prochaine
 * séance, et les chercher activité par activité ferait autant d'allers-retours
 * que d'activités.
 */
export const getActivites = cache(async (aujourdhui: string, heure = "00:00"): Promise<ActiviteListe[]> => {
  const supabase = await createServerSupabase();
  // Garde d'authentification sur une lecture (PR #61/#63) : sans elle, un
  // visiteur déclenche une requête qui échoue en « permission denied ».
  const auth = await getCachedUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from("activites")
    .select(
      `id, type, nom, statut, club_nom, adresse, telephone, lat, lng, formule_seances,
       activite_membres(family_members(id, first_name, avatar_color, profile_id)),
       activite_creneaux(id, jour_semaine, heure_debut, heure_fin, valide_du, valide_au, intervenant),
       activite_tags(tags(slug, label)),
       activite_seances(id)`,
    )
    .order("nom", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((a) => {
    const creneaux: Creneau[] = (a.activite_creneaux ?? []).map((c) => ({
      id: c.id,
      jourSemaine: c.jour_semaine,
      // Postgres rend « 10:00:00 » ; l'affichage et les comparaisons se font
      // sur « HH:MM ».
      heureDebut: c.heure_debut.slice(0, 5),
      heureFin: c.heure_fin.slice(0, 5),
      valideDu: c.valide_du,
      valideAu: c.valide_au,
    }));
    return {
      id: a.id,
      type: a.type,
      nom: a.nom,
      statut: a.statut,
      clubNom: a.club_nom,
      adresse: a.adresse,
      telephone: a.telephone,
      lat: a.lat,
      lng: a.lng,
      membres: (a.activite_membres ?? []).flatMap((am) => {
        const m = am.family_members;
        return m
          ? [{ id: m.id, prenom: m.first_name, couleur: m.avatar_color, estMoi: m.profile_id === auth.user!.id }]
          : [];
      }),
      creneaux,
      tags: (a.activite_tags ?? []).flatMap((at) =>
        at.tags ? [{ slug: at.tags.slug, label: at.tags.label }] : []),
      intervenants: (a.activite_creneaux ?? []).flatMap((c) => (c.intervenant ? [c.intervenant] : [])),
      prochaine: prochaineOccurrence(creneaux, aujourdhui, heure),
      // Faites ET manquées : une séance manquée est consommée.
      restantes: seancesRestantes(a.formule_seances, (a.activite_seances ?? []).length),
    };
  });
});
