import { z } from "zod";

export const goutsInputSchema = z.object({
  ambiances: z.array(z.string().max(100)).default([]),
  budgetMax: z.coerce.number().min(0).optional(),
  typesPreferes: z.array(z.string().max(100)).default([]),
  zones: z.array(z.string().max(100)).default([]),
});
export type GoutsInput = z.infer<typeof goutsInputSchema>;

export const rechercheCriteriaSchema = z.object({
  zone: z.string().max(100).optional(),
  budgetMax: z.coerce.number().min(0).optional(),
  ambiance: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
});
export type RechercheCriteria = z.infer<typeof rechercheCriteriaSchema>;
