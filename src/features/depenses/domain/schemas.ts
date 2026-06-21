import { z } from "zod";
import { centsFromEuros } from "./money";

export const DEPENSE_MODES = ["egal", "exact"] as const;

export const groupeInputSchema = z.object({
  titre: z.string().min(1).max(200),
  devise: z.string().length(3).optional(),
  voyageId: z.string().uuid().optional(),
});
export type GroupeInput = z.infer<typeof groupeInputSchema>;

export const depenseInputSchema = z.object({
  groupeId: z.string().uuid(),
  payePar: z.string().uuid(),
  libelle: z.string().min(1).max(200),
  montantCents: centsFromEuros,
  date: z.string().date().optional(),
  mode: z.enum(DEPENSE_MODES),
  participants: z.array(z.string().uuid()).min(1),
});
export type DepenseInput = z.infer<typeof depenseInputSchema>;

export const remboursementInputSchema = z
  .object({
    groupeId: z.string().uuid(),
    deProfileId: z.string().uuid(),
    versProfileId: z.string().uuid(),
    montantCents: centsFromEuros,
    date: z.string().date().optional(),
  })
  .refine((d) => d.deProfileId !== d.versProfileId, { message: "de et vers doivent différer", path: ["versProfileId"] });
export type RemboursementInput = z.infer<typeof remboursementInputSchema>;

export const shareGroupeSchema = z.object({
  groupeId: z.string().uuid(),
  email: z.string().email(),
});
export type ShareGroupeInput = z.infer<typeof shareGroupeSchema>;
