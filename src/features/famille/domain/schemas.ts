import { z } from "zod";

export const familleInputSchema = z.object({ nom: z.string().min(1).max(120) });
export type FamilleInput = z.infer<typeof familleInputSchema>;

export const inviteSchema = z.object({ email: z.string().email() });
export type InviteInput = z.infer<typeof inviteSchema>;

export const RELATIONS = ["conjoint", "enfant", "parent", "beau_parent", "ami", "autre"] as const;
export const CIRCLES = ["proche", "elargie", "amis"] as const;

export const procheInputSchema = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  relation: z.enum(RELATIONS),
  circle: z.enum(CIRCLES),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
});
export type ProcheInput = z.infer<typeof procheInputSchema>;

export const DOC_TYPES = ["passeport", "carte_identite", "permis_conduire", "permis_bateau", "visa", "titre_sejour", "autre"] as const;

export const documentInputSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  doc_number: z.string().max(120).optional().or(z.literal("")),
  country: z.string().max(120).optional().or(z.literal("")),
  holder_name: z.string().max(240).optional().or(z.literal("")),
  issue_date: z.string().optional().or(z.literal("")),
  expiry_date: z.string().optional().or(z.literal("")),
  issue_place: z.string().max(240).optional().or(z.literal("")),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;
