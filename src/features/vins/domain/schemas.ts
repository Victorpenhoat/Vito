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

// ── Vins & Cave (Lot V-C) : ma dégustation, et correction de l'analyse ──────

/** Lieux de dégustation (design écran 3) : un restaurant OU un lieu libre. */
export const LIEUX_DEGUSTATION = ["restaurant", "maison", "amis", "caviste", "autre"] as const;
export type LieuDegustation = (typeof LIEUX_DEGUSTATION)[number];

/** Le prix se compare mal sans son unité : 12 € au verre n'est pas 12 € la bouteille. */
export const PRIX_UNITES = ["bouteille", "verre"] as const;

const verres = z.coerce.number().min(0.5).max(5).transform((v) => Math.round(v * 2) / 2);

export const degustationCompleteSchema = z.object({
  vinId: z.string().uuid(),
  note: verres.optional(),
  commentaire: z.string().max(2000).optional().or(z.literal("")),
  prixPaye: z.coerce.number().min(0).max(100000).optional(),
  prixUnite: z.enum(PRIX_UNITES).optional(),
  lieuType: z.enum(LIEUX_DEGUSTATION).optional(),
  lieuNom: z.string().max(200).optional().or(z.literal("")),
  etablissementId: z.string().uuid().optional(),
  visiteId: z.string().uuid().optional(),
  degusteLe: z.string().date().optional(),
  aRacheter: z.coerce.boolean().default(false),
  /** Tags existants cochés, et tags créés à la volée (portée « vin »). */
  tagIds: z.array(z.string().uuid()).default([]),
  nouveauxTags: z.array(z.string().min(1).max(60)).default([]),
});
export type DegustationComplete = z.infer<typeof degustationCompleteSchema>;

/**
 * Correction de l'analyse (design écran 9). Tout est facultatif : on corrige le
 * champ qui cloche, pas la fiche entière. Une chaîne vide EFFACE la valeur —
 * c'est le seul moyen de retirer une information inventée par le modèle.
 */
export const correctionAnalyseSchema = z.object({
  vinId: z.string().uuid(),
  domaine: z.string().max(200).optional(),
  cuvee: z.string().max(200).optional(),
  appellation: z.string().max(200).optional(),
  region: z.string().max(200).optional(),
  millesime: z.union([z.coerce.number().int().min(1900).max(2100), z.literal("")]).optional(),
  degre: z.union([z.coerce.number().min(0).max(25), z.literal("")]).optional(),
  couleur: z.enum(VIN_COULEURS).optional().or(z.literal("")),
  cepages: z.array(z.string().max(100)).default([]),
});
