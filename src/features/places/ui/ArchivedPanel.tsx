"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { toggleArchive } from "@/features/restos/data/actions";
import type { Place } from "../domain/filterPlaces";

export function ArchivedPanel({ places }: { places: Place[] }) {
  const t = useTranslations("places");
  const tr = useTranslations("restos");
  const [, action] = useActionState(toggleArchive, undefined);
  if (places.length === 0) {
    return <p data-testid="archives-empty" className="text-sm text-muted">{t("archivesVide")}</p>;
  }
  return (
    <ul className="flex flex-col">
      {places.map((p) => {
        const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";
        return (
          <li key={p.id} data-testid="archived-item" className="flex items-center justify-between gap-3 border-b border-line-soft py-3">
            <Link href={`/${base}/${p.etablissement.id}`} className="min-w-0 text-accent hover:underline">
              <span className="font-serif text-base text-ink">{p.etablissement.nom}</span>
              {p.etablissement.ville ? <span className="text-sm text-muted"> · {p.etablissement.ville}</span> : null}
            </Link>
            <form action={action}>
              <input type="hidden" name="listeItemId" value={p.id} />
              <input type="hidden" name="isArchived" value="false" />
              <Button type="submit" variant="ghost" data-testid="archive-unarchive">{tr("desarchiver")}</Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
