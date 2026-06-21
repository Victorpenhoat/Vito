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
