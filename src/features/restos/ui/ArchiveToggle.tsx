"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toggleArchive } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function ArchiveToggle({ listeItemId, isArchived }: { listeItemId: string; isArchived: boolean }) {
  const t = useTranslations("restos");
  const [, action] = useActionState(toggleArchive, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <input type="hidden" name="isArchived" value={String(!isArchived)} />
      <Button type="submit" variant="ghost" data-testid="archive-toggle">
        {isArchived ? t("desarchiver") : t("archiver")}
      </Button>
    </form>
  );
}
