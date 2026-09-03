import { z } from "zod";

export const addRestoSchema = z.object({
  placeId: z.string().min(1),
});

export const addAvisSchema = z.object({
  etablissementId: z.string().uuid(),
  note: z.coerce.number().int().min(1).max(5).optional(),
  commentaire: z.string().max(2000).optional(),
  visiteLe: z.string().date().optional(),
});

export const setTagsSchema = z.object({
  listeItemId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()),
});

export const toggleFavoriteSchema = z.object({
  listeItemId: z.string().uuid(),
  // Vient d'un champ de formulaire (string "true"/"false"). z.coerce.boolean()
  // est piégeux ici : Boolean("false") === true. On parse explicitement.
  isFavorite: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const toggleArchiveSchema = z.object({
  listeItemId: z.string().uuid(),
  isArchived: z.enum(["true", "false"]).transform((v) => v === "true"),
});

// ── Restos v2 (Lot R-A) ─────────────────────────────────────────────────────

export const marquerVisiteSchema = z.object({
  listeItemId: z.string().uuid(),
  // Note /10 au dixième (slider « 8,2 »). Pas de multipleOf(0.1) : les flottants
  // font échouer le reste (8.2 % 0.1 ≠ 0) — on arrondit au dixième à la place.
  note: z.coerce.number().min(0).max(10).transform((v) => Math.round(v * 10) / 10).optional(),
  commentaire: z.string().max(2000).optional(),
  visiteLe: z.string().date().optional(),
  passerEnFavori: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

// ── Hôtels v2 (Lot H3) ──────────────────────────────────────────────────────

/** Séjour = visite avec plage de dates, voyage lié et occupation (tout optionnel
 *  sauf l'item et l'arrivée). visiteLe porte l'arrivée, dateFin le départ. */
export const marquerSejourSchema = marquerVisiteSchema.extend({
  dateFin: z.string().date().optional().or(z.literal("")),
  voyageId: z.string().uuid().optional().or(z.literal("")),
  adultes: z.coerce.number().int().min(1).max(20).optional(),
  enfants: z.coerce.number().int().min(0).max(20).optional(),
  chambres: z.coerce.number().int().min(1).max(10).optional(),
}).refine((d) => !d.dateFin || !d.visiteLe || d.dateFin >= d.visiteLe, {
  message: "Le départ doit suivre l'arrivée",
  path: ["dateFin"],
});

/** Infos hôtel saisies par l'utilisateur (le fournisseur ne les donne pas). */
export const setInfosHotelSchema = z.object({
  listeItemId: z.string().uuid(),
  etoiles: z.coerce.number().int().min(1).max(5).optional(),
  prixNuit: z.coerce.number().min(0).max(99999).optional(),
  checkinHeure: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  checkoutHeure: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
});

export const changerStatutSchema = z.object({
  listeItemId: z.string().uuid(),
  statut: z.enum(["favori", "a_tester", "teste"]),
});

export const setOrigineSchema = z.object({
  listeItemId: z.string().uuid(),
  origineType: z.enum(["reco", "trouve"]),
  origineQui: z.string().max(120).optional().or(z.literal("")),
  origineFamilyMemberId: z.string().uuid().optional().or(z.literal("")),
  origineSource: z.string().max(120).optional().or(z.literal("")),
});

// ── Tags v2 (Lot R-B) ───────────────────────────────────────────────────────

export const TAG_SCOPES = ["common", "restaurant", "hotel"] as const;

export const creerTagSchema = z.object({
  label: z.string().min(1).max(60),
  scope: z.enum(TAG_SCOPES),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
});

export const updateTagSchema = z.object({
  tagId: z.string().uuid(),
  label: z.string().min(1).max(60),
  scope: z.enum(TAG_SCOPES),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
});

export const fusionnerTagsSchema = z.object({
  sourceId: z.string().uuid(),
  cibleId: z.string().uuid(),
});

export const supprimerTagSchema = z.object({
  tagId: z.string().uuid(),
});
