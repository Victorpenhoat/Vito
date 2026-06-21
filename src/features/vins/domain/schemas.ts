import { z } from "zod";

export const VIN_COULEURS = ["rouge", "blanc", "rose", "petillant", "autre"] as const;

export const degustationInputSchema = z.object({
  nom: z.string().min(1).max(200),
  domaine: z.string().max(200).optional(),
  millesime: z.coerce.number().int().min(1900).max(2100).optional(),
  region: z.string().max(200).optional(),
  couleur: z.enum(VIN_COULEURS).optional(),
  cepages: z.array(z.string().max(100)).default([]),
  etablissementId: z.string().uuid().optional(),
  avisId: z.string().uuid().optional(),
  degusteLe: z.string().date().optional(),
  note: z.coerce.number().int().min(1).max(5).optional(),
  prixPaye: z.coerce.number().min(0).optional(),
  commentaire: z.string().max(2000).optional(),
});
export type DegustationInput = z.infer<typeof degustationInputSchema>;

export const vinFiltersSchema = z.object({
  couleur: z.enum(VIN_COULEURS).optional(),
  region: z.string().max(200).optional(),
  noteMin: z.coerce.number().int().min(1).max(5).optional(),
  etablissementId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});
export type VinFilters = z.infer<typeof vinFiltersSchema>;
