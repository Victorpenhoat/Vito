import { z } from "zod";

export const familleInputSchema = z.object({ nom: z.string().min(1).max(120) });
export type FamilleInput = z.infer<typeof familleInputSchema>;

export const inviteSchema = z.object({ email: z.string().email() });
export type InviteInput = z.infer<typeof inviteSchema>;

// Relations : les 6 valeurs historiques restent valides (données existantes) ;
// la refonte Cercle ajoute les relations gendrées du design + « moi » (fiche
// épinglée, unique par utilisateur — index partiel en 00027).
export const RELATIONS = [
  "moi", "conjoint", "fille", "fils", "pere", "mere",
  "enfant", "parent", "beau_parent", "ami", "autre",
] as const;
// Conservé pour la colonne circle (défaut DB 'proche') — plus exposé au formulaire.
export const CIRCLES = ["proche", "elargie", "amis"] as const;

export const procheInputSchema = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  relation: z.enum(RELATIONS),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  birth_place: z.string().max(240).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  address_inherit: z.boolean(),
});
export type ProcheInput = z.infer<typeof procheInputSchema>;

export const DOC_TYPES = ["passeport", "carte_identite", "permis_conduire", "securite_sociale", "permis_bateau", "visa", "titre_sejour", "autre"] as const;

// Types « identité » : rangés dans la section Identité de la fiche ; le reste
// (permis bateau, visa, titre de séjour, autre…) va en Documents complémentaires.
export const IDENTITY_DOC_TYPES: readonly string[] = ["passeport", "carte_identite", "permis_conduire", "securite_sociale"];

export const documentInputSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  doc_label: z.string().max(120).optional().or(z.literal("")),
  doc_number: z.string().max(120).optional().or(z.literal("")),
  country: z.string().max(120).optional().or(z.literal("")),
  holder_name: z.string().max(240).optional().or(z.literal("")),
  issue_date: z.string().optional().or(z.literal("")),
  expiry_date: z.string().optional().or(z.literal("")),
  issue_place: z.string().max(240).optional().or(z.literal("")),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;
