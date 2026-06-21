"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toggleFavorite } from "../data/actions";

export function FavoriteToggle({ listeItemId, isFavorite }: { listeItemId: string; isFavorite: boolean }) {
  const t = useTranslations("restos");
  const [, action] = useActionState(toggleFavorite, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <input type="hidden" name="isFavorite" value={String(!isFavorite)} />
      <button type="submit" data-testid="favorite-toggle">{isFavorite ? "★ " : "☆ "}{t("favorite")}</button>
    </form>
  );
}
