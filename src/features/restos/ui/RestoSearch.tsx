"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto } from "../data/actions";
import type { PlaceSummary } from "@/lib/services/places/types";

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
        className="border p-2"
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
          <li key={r.placeId} data-testid="search-result" className="flex justify-between border-b py-2">
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
              <button type="submit" disabled={pending} className="underline">{t("add")}</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
