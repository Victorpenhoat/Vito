"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto } from "../data/actions";
import { splitSearch } from "../domain/splitSearch";
import type { Place } from "@/features/places/domain/filterPlaces";
import type { PlaceSummary } from "@/lib/services/places/types";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";

export function RestoSearch({ places }: { places: Place[] }) {
  const t = useTranslations("restos");
  const [q, setQ] = useState("");
  const [externals, setExternals] = useState<PlaceSummary[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const { favoris, aTester, externes } = splitSearch(q, places, externals);

  const ownedRow = (p: Place) => (
    <li key={p.id} data-testid="owned-result" className="border-b border-line-soft py-2">
      <Link href={`/restos/${p.etablissement.id}`} className="text-accent hover:underline">
        {p.etablissement.nom}
        {p.etablissement.ville ? <span className="text-muted"> · {p.etablissement.ville}</span> : null}
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        data-testid="add-resto-search"
        placeholder={t("search")}
        value={q}
        className="rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-accent"
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          start(async () => setExternals(await searchPlaces(v)));
        }}
      />
      {addError && (
        <p role="alert" className="text-sm text-red-600" data-testid="add-resto-error">{addError}</p>
      )}

      {favoris.length > 0 && (
        <section>
          <SectionLabel>{t("resFavoris")}</SectionLabel>
          <ul>{favoris.map(ownedRow)}</ul>
        </section>
      )}
      {aTester.length > 0 && (
        <section>
          <SectionLabel>{t("resATester")}</SectionLabel>
          <ul>{aTester.map(ownedRow)}</ul>
        </section>
      )}
      {externes.length > 0 && (
        <section>
          <SectionLabel>{t("resExternes")}</SectionLabel>
          <ul>
            {externes.map((r) => (
              <li key={r.placeId} data-testid="search-result" className="flex justify-between border-b border-line-soft py-2">
                <span>{r.nom}{r.adresse ? ` — ${r.adresse}` : ""}</span>
                <form
                  action={(fd) =>
                    start(async () => {
                      const res = await addResto(undefined, fd);
                      if (res?.error) {
                        setAddError(res.error);
                      } else {
                        setAddError(null);
                        setExternals([]);
                        setQ("");
                      }
                    })
                  }
                >
                  <input type="hidden" name="placeId" value={r.placeId} />
                  <Button type="submit" variant="ghost" pending={pending}>{t("add")}</Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
