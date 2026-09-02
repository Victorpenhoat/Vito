// Server actions par catégorie pour la brique générique. Les actions vivent
// dans restos/data/actions.ts (historique) ; cette map évite aux composants
// génériques de brancher sur la catégorie eux-mêmes.
import { addResto, addHotel } from "@/features/restos/data/actions";
import type { CategorieUi } from "../domain/categoryUiConfig";

type AddAction = (prev: unknown, formData: FormData) => Promise<{ error?: string }>;

export const addActionFor: Record<CategorieUi, AddAction> = {
  resto: addResto,
  hotel: addHotel,
};
