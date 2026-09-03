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
  // Note en VERRES /5 par demi-verre (design Vins & Cave — la note resto reste
  // /10). Le pas de 0,5 est exactement représentable en binaire : l'arrondi au
  // demi est sûr, contrairement au pas de 0,1 des notes /10.
  note: z.coerce.number().min(0.5).max(5).transform((v) => Math.round(v * 2) / 2).optional(),
  prixPaye: z.coerce.number().min(0).optional(),
  commentaire: z.string().max(2000).optional(),
});
export type DegustationInput = z.infer<typeof degustationInputSchema>;

export const vinFiltersSchema = z.object({
  couleur: z.enum(VIN_COULEURS).optional(),
  region: z.string().max(200).optional(),
  noteMin: z.coerce.number().min(0.5).max(5).optional(),
  etablissementId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});
export type VinFilters = z.infer<typeof vinFiltersSchema>;

// ── Vins & Cave (Lot V-B) : création d'un vin depuis une étiquette ───────────

/** Champs confirmés par l'utilisateur après lecture de l'étiquette. */
export const creerVinSchema = z.object({
  nom: z.string().min(1).max(200),
  domaine: z.string().max(200).optional().or(z.literal("")),
  cuvee: z.string().max(200).optional().or(z.literal("")),
  appellation: z.string().max(200).optional().or(z.literal("")),
  millesime: z.coerce.number().int().min(1900).max(2100).optional(),
  region: z.string().max(200).optional().or(z.literal("")),
  couleur: z.enum(VIN_COULEURS).optional(),
  cepages: z.array(z.string().max(100)).default([]),
  degre: z.coerce.number().min(0).max(25).optional(),
  /** Analyse générée + confiance par champ, telles que rendues par le service. */
  analyse: z.string().optional(),
  confiance: z.string().optional(),
  modele: z.string().max(80).optional(),
});
