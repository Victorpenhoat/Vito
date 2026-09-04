import { z } from "zod";

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
export type VoyageInput = z.infer<typeof voyageInputSchema>;

export const reservationInputSchema = z
  .object({
    voyageId: z.string().uuid(),
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
export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const shareInputSchema = z.object({
  voyageId: z.string().uuid(),
  email: z.string().email(),
});
export type ShareInput = z.infer<typeof shareInputSchema>;

// ── Lot B : participants et programme ───────────────────────────────────────

/** Un participant vient d'un compte, d'un proche du Cercle, ou de nulle part
 *  (saisie libre) — jamais de deux sources à la fois. */
export const participantInputSchema = z
  .object({
    voyageId: z.string().uuid(),
    profileId: z.string().uuid().optional(),
    familyMemberId: z.string().uuid().optional(),
    displayName: z.string().trim().min(1).max(120),
    email: z.string().email().max(200).optional(),
    role: z.enum(["organisateur", "voyageur"]).optional(),
  })
  .refine((d) => !(d.profileId && d.familyMemberId), {
    message: "Un participant a au plus une source",
    path: ["familyMemberId"],
  });
export type ParticipantInput = z.infer<typeof participantInputSchema>;

/** Une étape peut n'avoir ni jour ni heure : une envie se note avant de se caler. */
export const etapeInputSchema = z.object({
  voyageId: z.string().uuid(),
  jour: z.string().date().optional(),
  heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide").optional(),
  titre: z.string().trim().min(1).max(200),
  lieu: z.string().max(200).optional(),
  etablissementId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});
export type EtapeInput = z.infer<typeof etapeInputSchema>;
