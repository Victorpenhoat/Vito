import { z } from "zod";

export const VOYAGE_STATUTS = ["planifie", "confirme", "en_cours", "termine"] as const;
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
  })
  .refine(datesOk, { message: "dateFin doit être >= dateDebut", path: ["dateFin"] });
export type VoyageInput = z.infer<typeof voyageInputSchema>;

export const reservationInputSchema = z
  .object({
    voyageId: z.string().uuid(),
    type: z.enum(RESERVATION_TYPES),
    fournisseur: z.string().max(200).optional(),
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
