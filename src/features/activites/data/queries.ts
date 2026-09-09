import { cache } from "react";
import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";
import { prochaineOccurrence, seancesRestantes, type Creneau, type Occurrence } from "../domain/activite";

type MembreActivite = {
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

type CreneauDetail = Creneau & {
  lieuPrecision: string | null;
  intervenant: string | null;
  deposePar: { id: string; prenom: string } | null;
  /** Troisième état du « qui dépose » : un arrangement hors du foyer. */
  covoiturage: boolean;
};

export type ActiviteDetail = ActiviteListe & {
  contactNom: string | null;
  contactTelephone: string | null;
  email: string | null;
  siteWeb: string | null;
  espaceFamilleUrl: string | null;
  consignesAcces: string | null;
  notes: string | null;
  formuleSeances: number | null;
  saisonDebut: string | null;
  saisonFin: string | null;
  creneauxDetail: CreneauDetail[];
  seances: { date: string; statut: "faite" | "manquee"; motif: string | null }[];
  paiements: {
    id: string; libelle: string; montantCents: number; devise: string;
    echeance: string | null; statut: "du" | "paye"; periodicite: string | null; moyen: string | null;
  }[];
  /**
   * Codes d'accès SANS leur valeur : même chiffrée, elle n'a rien à faire dans
   * une page. Le clair n'arrive que par `revelerCode`, après re-authentification.
   */
  codes: { id: string; libelle: string; note: string | null }[];
  /** Documents sans leur contenu : seule la route protégée le délivre. */
  documents: {
    id: string; type: string; nom: string; sensible: boolean;
    taille: number; expireLe: string | null;
  }[];
};

/**
 * Une activité et tout ce que sa fiche montre — sauf les codes et les
 * documents, qui ne se lisent pas par une requête ordinaire.
 *
 * `null` quand l'activité n'existe pas OU ne m'appartient pas : la RLS ne
 * distingue pas les deux, et l'écran non plus. Répondre « elle existe mais
 * pas pour vous » dirait déjà quelque chose.
 */
export const getActiviteDetail = cache(async (
  id: string, aujourdhui: string, heure = "00:00",
): Promise<ActiviteDetail | null> => {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("activites")
    .select(
      `id, type, nom, statut, club_nom, adresse, telephone, contact_nom, contact_telephone,
       email, site_web, espace_famille_url,
       consignes_acces, notes, lat, lng, formule_seances, saison_debut, saison_fin,
       activite_membres(family_members(id, first_name, avatar_color, profile_id)),
       activite_creneaux(id, jour_semaine, heure_debut, heure_fin, valide_du, valide_au,
                         intervenant, lieu_precision, depose_covoiturage,
                         depose:family_members(id, first_name)),
       activite_tags(tags(slug, label)),
       activite_seances(date, statut, motif),
       activite_paiements(id, libelle, montant_cents, devise, echeance, statut, periodicite, moyen),
       activite_codes(id, libelle, note),
       activite_documents(id, type, nom, sensible, taille, expire_le)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const creneauxDetail: CreneauDetail[] = (data.activite_creneaux ?? []).map((c) => ({
    id: c.id,
    jourSemaine: c.jour_semaine,
    heureDebut: c.heure_debut.slice(0, 5),
    heureFin: c.heure_fin.slice(0, 5),
    valideDu: c.valide_du,
    valideAu: c.valide_au,
    lieuPrecision: c.lieu_precision,
    intervenant: c.intervenant,
    deposePar: c.depose ? { id: c.depose.id, prenom: c.depose.first_name } : null,
    covoiturage: c.depose_covoiturage,
  }));

  const seances = (data.activite_seances ?? []).map((s) => ({
    date: s.date,
    statut: s.statut as "faite" | "manquee",
    motif: s.motif,
  }));

  return {
    id: data.id,
    type: data.type,
    nom: data.nom,
    statut: data.statut,
    clubNom: data.club_nom,
    adresse: data.adresse,
    telephone: data.telephone,
    contactNom: data.contact_nom,
    contactTelephone: data.contact_telephone,
    lat: data.lat,
    lng: data.lng,
    email: data.email,
    siteWeb: data.site_web,
    espaceFamilleUrl: data.espace_famille_url,
    consignesAcces: data.consignes_acces,
    notes: data.notes,
    formuleSeances: data.formule_seances,
    saisonDebut: data.saison_debut,
    saisonFin: data.saison_fin,
    membres: (data.activite_membres ?? []).flatMap((am) => {
      const m = am.family_members;
      return m
        ? [{ id: m.id, prenom: m.first_name, couleur: m.avatar_color, estMoi: m.profile_id === auth.user!.id }]
        : [];
    }),
    creneaux: creneauxDetail,
    creneauxDetail,
    tags: (data.activite_tags ?? []).flatMap((at) =>
      at.tags ? [{ slug: at.tags.slug, label: at.tags.label }] : []),
    intervenants: creneauxDetail.flatMap((c) => (c.intervenant ? [c.intervenant] : [])),
    prochaine: prochaineOccurrence(creneauxDetail, aujourdhui, heure),
    restantes: seancesRestantes(data.formule_seances, seances.length),
    seances,
    paiements: (data.activite_paiements ?? []).map((p) => ({
      id: p.id,
      libelle: p.libelle,
      montantCents: Number(p.montant_cents),
      devise: p.devise,
      echeance: p.echeance,
      statut: p.statut as "du" | "paye",
      periodicite: p.periodicite,
      moyen: p.moyen,
    })),
    codes: (data.activite_codes ?? []).map((c) => ({ id: c.id, libelle: c.libelle, note: c.note })),
    documents: (data.activite_documents ?? []).map((d) => ({
      id: d.id, type: d.type, nom: d.nom, sensible: d.sensible,
      taille: d.taille, expireLe: d.expire_le,
    })),
  };
});

/**
 * Ce qu'il faut pour bâtir la semaine : les activités avec leurs créneaux
 * détaillés et les exceptions de la période.
 *
 * Requête distincte de la liste : celle-ci a besoin du « qui dépose » et des
 * annulations, dont la liste n'a que faire. Les charger partout aurait alourdi
 * l'écran le plus consulté pour servir le second.
 */
export const getActivitesSemaine = cache(async (du: string, au: string) => {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return { activites: [], exceptions: [] };

  const { data, error } = await supabase
    .from("activites")
    .select(
      `id, nom, club_nom, statut,
       activite_membres(family_members(id, first_name, avatar_color)),
       activite_creneaux(id, jour_semaine, heure_debut, heure_fin, valide_du, valide_au,
                         lieu_precision, depose_covoiturage, depose:family_members(id, first_name),
                         activite_creneau_exceptions(creneau_id, date, type, heure_debut, heure_fin))`,
    )
    .eq("statut", "en_cours");
  if (error) throw error;

  const activites = (data ?? []).map((a) => ({
    id: a.id,
    nom: a.nom,
    clubNom: a.club_nom,
    statut: a.statut,
    membres: (a.activite_membres ?? []).flatMap((am) =>
      am.family_members
        ? [{ id: am.family_members.id, prenom: am.family_members.first_name, couleur: am.family_members.avatar_color }]
        : []),
    creneaux: (a.activite_creneaux ?? []).map((c) => ({
      id: c.id,
      jourSemaine: c.jour_semaine,
      heureDebut: c.heure_debut.slice(0, 5),
      heureFin: c.heure_fin.slice(0, 5),
      valideDu: c.valide_du,
      valideAu: c.valide_au,
      lieuPrecision: c.lieu_precision,
      deposePar: c.depose ? { id: c.depose.id, prenom: c.depose.first_name } : null,
      covoiturage: c.depose_covoiturage,
    })),
  }));

  // Les exceptions de la seule semaine affichée : les charger toutes ferait
  // grossir la requête à mesure que le carnet vieillit.
  const exceptions = (data ?? []).flatMap((a) =>
    (a.activite_creneaux ?? []).flatMap((c) =>
      (c.activite_creneau_exceptions ?? [])
        .filter((e) => e.date >= du && e.date <= au)
        .map((e) => ({
          creneauId: e.creneau_id,
          date: e.date,
          type: e.type as "annulation" | "ponctuelle",
          heureDebut: e.heure_debut ? e.heure_debut.slice(0, 5) : null,
          heureFin: e.heure_fin ? e.heure_fin.slice(0, 5) : null,
        })),
    ),
  );

  return { activites, exceptions };
});

/**
 * Tout ce qui demande une action, en UNE requête.
 *
 * Le compteur de la barre de navigation s'en sert aussi : agréger côté client,
 * ou interroger une table par type d'alerte, ferait autant d'allers-retours que
 * de familles d'échéances.
 */
export const getAlertesActivites = cache(async () => {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return { activites: [] };

  const { data, error } = await supabase
    .from("activites")
    .select(
      `id, nom,
       activite_membres(family_members(first_name)),
       activite_paiements(id, montant_cents, devise, echeance, statut),
       activite_documents(id, type, expire_le)`,
    )
    .neq("statut", "terminee");
  if (error) throw error;

  return {
    activites: (data ?? []).map((a) => ({
      id: a.id,
      nom: a.nom,
      membres: (a.activite_membres ?? []).flatMap((am) =>
        am.family_members ? [{ prenom: am.family_members.first_name }] : []),
      paiements: (a.activite_paiements ?? []).map((p) => ({
        id: p.id,
        montantCents: Number(p.montant_cents),
        devise: p.devise,
        echeance: p.echeance,
        statut: p.statut as "du" | "paye",
      })),
      documents: (a.activite_documents ?? []).map((d) => ({
        id: d.id, type: d.type, expireLe: d.expire_le,
      })),
    })),
  };
});

/** Les activités d'un membre — bloc « Activités » de sa fiche dans le Cercle. */
export const getActivitesDuMembre = cache(async (membreId: string, aujourdhui: string) => {
  const toutes = await getActivites(aujourdhui);
  return toutes.filter((a) => a.membres.some((m) => m.id === membreId));
});

/**
 * Le point de départ des trajets : l'adresse du foyer, c'est-à-dire la fiche
 * « Moi » du Cercle.
 *
 * `null` tant qu'elle n'a pas été située — la durée ne s'affiche alors pas,
 * plutôt que d'être calculée depuis un point faux.
 */
export const getPointDuFoyer = cache(async (): Promise<{ lat: number; lng: number } | null> => {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("family_members")
    .select("lat, lng")
    .eq("relation", "moi")
    .maybeSingle();
  return data?.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : null;
});
