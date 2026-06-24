"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto } from "../data/actions";
import type { PlaceSummary } from "@/lib/services/places/types";
import { Button } from "@/features/shared/ui/Button";

export function RestoSearch() {
  const t = useTranslations("restos");
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <input
        data-testid="add-resto-search"
        placeholder={t("search")}
        className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent"
        onChange={(e) => {
          const q = e.target.value;
          start(async () => setResults(await searchPlaces(q)));
        }}
      />
      {addError && (
        <p role="alert" className="text-red-600 text-sm" data-testid="add-resto-error">
          {addError}
        </p>
      )}
      <ul>
        {results.map((r) => (
          <li key={r.placeId} data-testid="search-result" className="flex justify-between border-b border-line py-2">
            <span>{r.nom} — {r.adresse}</span>
            <form
              action={(fd) =>
                start(async () => {
                  const res = await addResto(undefined, fd);
                  if (res?.error) {
                    setAddError(res.error);
                  } else {
                    setAddError(null);
                    setResults([]);
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
    </div>
  );
}
