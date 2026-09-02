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
