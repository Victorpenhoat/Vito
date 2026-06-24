"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toggleFavorite } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function FavoriteToggle({ listeItemId, isFavorite }: { listeItemId: string; isFavorite: boolean }) {
  const t = useTranslations("restos");
  const [, action] = useActionState(toggleFavorite, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <input type="hidden" name="isFavorite" value={String(!isFavorite)} />
      <Button type="submit" variant="ghost" data-testid="favorite-toggle">{isFavorite ? "★ " : "☆ "}{t("favorite")}</Button>
    </form>
  );
}
