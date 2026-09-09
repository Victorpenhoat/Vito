import { z } from "zod";
import { DEVISES } from "./devises";
import { centsFromEuros } from "@/features/depenses/domain/money";
import { DEPENSE_MODES } from "@/features/depenses/domain/schemas";

// idee/en_preparation : refonte Voyages (00028). planifie/en_cours restent valides
// (données existantes) ; « En cours » est normalement dérivé des dates (affichageVoyage).
export const VOYAGE_STATUTS = ["idee", "en_preparation", "planifie", "confirme", "en_cours", "termine"] as const;
// Choix proposés au formulaire (planifie = legacy, en_cours = dérivé — non proposés)
export const VOYAGE_STATUTS_FORM = ["idee", "en_preparation", "confirme", "termine"] as const;
export const RESERVATION_TYPES = ["hotel", "vol", "voiture", "hebergement", "autre"] as const;

const datesOk = (d: { dateDebut?: string; dateFin?: string }) =>
  !d.dateDebut || !d.dateFin || d.dateFin >= d.dateDebut;

export const voyageInputSchema = z
  .object({
    titre: z.string().min(1).max(200),
    destination: z.string().max(200).optional(),
    dateDebut: z.string().date().optional(),
    dateFin: z.string().date().optional(),
    statut: z.enum(VOYAGE_STATUTS).optional(),
    periodeTexte: z.string().max(120).optional(),
    coverPhotoRef: z.string().max(1000).optional(),
    coverUrl: z.string().url().startsWith("https://").max(1000).optional(),
  })
  .refine(datesOk, { message: "dateFin doit être >= dateDebut", path: ["dateFin"] });

export const reservationInputSchema = z
  .object({
    voyageId: z.guid(),
    type: z.enum(RESERVATION_TYPES),
    fournisseur: z.string().max(200).optional(),
    // Hôtels v2 (H6) : l'hébergement réservé, désigné chez le fournisseur.
    // Il rejoint le carnet et la réservation le pointe. Rester en texte libre
    // reste permis : toutes les réservations ne visent pas un lieu identifiable.
    placeId: z.string().max(300).optional(),
    reference: z.string().max(200).optional(),
    dateDebut: z.string().date().optional(),
    dateFin: z.string().date().optional(),
    conciergerieTel: z.string().max(50).optional(),
    conciergerieMail: z.string().email().optional(),
    lien: z.string().url().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(datesOk, { message: "dateFin doit être >= dateDebut", path: ["dateFin"] });

export const shareInputSchema = z.object({
  voyageId: z.guid(),
  email: z.string().email(),
});

// ── Lot B : participants et programme ───────────────────────────────────────

/** Un participant vient d'un compte, d'un proche du Cercle, ou de nulle part
 *  (saisie libre) — jamais de deux sources à la fois. */
export const participantInputSchema = z
  .object({
    // z.guid() et non z.uuid() : Zod v4 impose à `uuid()` les bits de variante
    // RFC 4122, ce qui REJETTE des identifiants pourtant valides côté base (les
    // comptes de démonstration, mais aussi tout id importé). Le reste du dépôt
    // fait déjà ce choix — l'oubli ici empêchait d'ajouter un compte comme
    // voyageur, sans message compréhensible.
    voyageId: z.guid(),
    profileId: z.guid().optional(),
    familyMemberId: z.guid().optional(),
    displayName: z.string().trim().min(1).max(120),
    email: z.email().max(200).optional(),
    role: z.enum(["organisateur", "voyageur"]).optional(),
    typeVoyageur: z.enum(["adulte", "enfant"]).optional(),
  })
  .refine((d) => !(d.profileId && d.familyMemberId), {
    message: "Un participant a au plus une source",
    path: ["familyMemberId"],
  });

/** Catégories d'étape de la maquette « Programme ». */
export const CATEGORIES_ETAPE = ["trajet", "hebergement", "restaurant", "activite", "note", "autre"] as const;
/** Moments de journée, quand l'heure exacte n'a pas de sens. */
export const MOMENTS_ETAPE = ["matin", "midi", "apres_midi", "soir"] as const;

/** Une étape peut n'avoir ni jour ni heure : une envie se note avant de se caler. */
export const etapeInputSchema = z.object({
  voyageId: z.guid(),
  jour: z.string().date().optional(),
  heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide").optional(),
  titre: z.string().trim().min(1).max(200),
  lieu: z.string().max(200).optional(),
  etablissementId: z.guid().optional(),
  notes: z.string().max(2000).optional(),
  categorie: z.enum(CATEGORIES_ETAPE).optional(),
  moment: z.enum(MOMENTS_ETAPE).optional(),
}).refine((d) => !(d.heure && d.moment), {
  message: "Une étape porte une heure OU un moment, pas les deux",
  path: ["moment"],
});

// ── Lot D : dépenses du voyage (entre VOYAGEURS, pas entre comptes) ─────────
// `centsFromEuros` et les modes viennent du domaine Dépenses : le partage est
// le même calcul, seule l'identité des participants change.

/** Catégories de la maquette « Ajout d'une dépense ». */
export const CATEGORIES_DEPENSE = ["hebergement", "restaurant", "transport", "activite", "courses", "autre"] as const;

export const depenseVoyageInputSchema = z.object({
  voyageId: z.guid(),
  categorie: z.enum(CATEGORIES_DEPENSE).optional(),
  payePar: z.guid(),
  libelle: z.string().trim().min(1).max(200),
  // Le montant est saisi dans `deviseSaisie` — la devise du voyage par défaut.
  // La conversion se fait dans l'action, qui seule connaît la devise du voyage.
  montantCents: centsFromEuros,
  deviseSaisie: z.enum(DEVISES).optional(),
  // Un taux ne se transporte pas en centimes : c'est un facteur, pas un
  // montant. Il vient du fournisseur ou de la main de l'utilisateur.
  taux: z.coerce.number().positive().optional(),
  tauxDate: z.string().date().optional(),
  date: z.string().date().optional(),
  mode: z.enum(DEPENSE_MODES),
  participants: z.array(z.guid()).min(1),
});

export const remboursementVoyageInputSchema = z
  .object({
    voyageId: z.guid(),
    deParticipantId: z.guid(),
    versParticipantId: z.guid(),
    montantCents: centsFromEuros,
    date: z.string().date().optional(),
  })
  .refine((d) => d.deParticipantId !== d.versParticipantId, {
    message: "Se rembourser soi-même ne veut rien dire",
    path: ["versParticipantId"],
  });
