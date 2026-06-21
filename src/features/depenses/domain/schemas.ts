import { z } from "zod";
import { centsFromEuros } from "./money";

export const DEPENSE_MODES = ["egal", "exact"] as const;

// Note: z.guid() is used instead of z.string().uuid() because Zod v4's uuid() enforces
// strict RFC 4122 variant bits, which rejects dev-seed UUIDs like 11111111-... and 22222222-...
// z.guid() accepts any well-formed UUID regardless of variant/version bits.
export const groupeInputSchema = z.object({
  titre: z.string().min(1).max(200),
  devise: z.string().length(3).optional(),
  voyageId: z.guid().optional(),
});
export type GroupeInput = z.infer<typeof groupeInputSchema>;

export const depenseInputSchema = z.object({
  groupeId: z.guid(),
  payePar: z.guid(),
  libelle: z.string().min(1).max(200),
  montantCents: centsFromEuros,
  date: z.string().date().optional(),
  mode: z.enum(DEPENSE_MODES),
  participants: z.array(z.guid()).min(1),
});
export type DepenseInput = z.infer<typeof depenseInputSchema>;

export const remboursementInputSchema = z
  .object({
    groupeId: z.guid(),
    deProfileId: z.guid(),
    versProfileId: z.guid(),
    montantCents: centsFromEuros,
    date: z.string().date().optional(),
  })
  .refine((d) => d.deProfileId !== d.versProfileId, { message: "de et vers doivent différer", path: ["versProfileId"] });
export type RemboursementInput = z.infer<typeof remboursementInputSchema>;

export const shareGroupeSchema = z.object({
  groupeId: z.guid(),
  email: z.string().email(),
});
export type ShareGroupeInput = z.infer<typeof shareGroupeSchema>;
