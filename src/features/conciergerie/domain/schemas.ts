import { z } from "zod";

export const OCCASIONS = ["amis", "famille", "anniversaire", "autre"] as const;
export const SEJOUR_TYPES = ["loisirs", "pro"] as const;
export const CONCIERGERIE_STATUTS = ["nouvelle", "en_cours", "confirmee", "refusee"] as const;

export const demandeRestoSchema = z.object({
  etablissementId: z.string().uuid(),
  dateResa: z.string().date(),
  heureResa: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide"),
  nombreConvives: z.coerce.number().int().positive(),
  avecEnfants: z.boolean().optional().default(false),
  nbEnfants: z.coerce.number().int().min(0).optional().default(0),
  chaiseHaute: z.boolean().optional().default(false),
  occasion: z.enum(OCCASIONS),
  commentaire: z.string().max(2000).optional(),
});
export type DemandeRestoInput = z.infer<typeof demandeRestoSchema>;

export const demandeHotelSchema = z.object({
  placeId: z.string().min(1),
  dateDebut: z.string().date(),
  nombreNuits: z.coerce.number().int().positive(),
  sejourType: z.enum(SEJOUR_TYPES),
  avecEnfants: z.boolean().optional().default(false),
  nbEnfants: z.coerce.number().int().min(0).optional().default(0),
  enfantsAges: z.array(z.coerce.number().int().min(0)).optional(),
  commentaire: z.string().max(2000).optional(),
});
export type DemandeHotelInput = z.infer<typeof demandeHotelSchema>;

export const reponseSchema = z.object({
  demandeId: z.string().uuid(),
  statut: z.enum(CONCIERGERIE_STATUTS),
  reponse: z.string().max(2000).optional(),
});
export type ReponseInput = z.infer<typeof reponseSchema>;
