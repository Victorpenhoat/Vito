import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PlaceEmptyState } from "./PlaceEmptyState";
import frMessages from "../../../../messages/fr.json";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";
import itMessages from "../../../../messages/it.json";

// Garde anti-régression : rend PlaceEmptyState avec les VRAIS fichiers messages/*.json
// (pas un mock) pour qu'une clé d'état vide manquante ou mal orthographiée dans une locale
// échoue au test unitaire plutôt qu'à l'exécution / en e2e.
type Messages = { places: Record<string, string> };
const locales: [string, Messages][] = [
  ["fr", frMessages as unknown as Messages],
  ["en", enMessages as unknown as Messages],
  ["es", esMessages as unknown as Messages],
  ["it", itMessages as unknown as Messages],
];

const renderState = (
  locale: string,
  messages: Messages,
  props: Parameters<typeof PlaceEmptyState>[0],
) =>
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PlaceEmptyState {...props} />
    </NextIntlClientProvider>,
  );

describe("PlaceEmptyState — i18n réel (4 locales)", () => {
  it.each(locales)("%s — favoris hôtel : titre + CTA résolus depuis la vraie locale", (loc, m) => {
    renderState(loc, m, { category: "hotel", kind: "favoris", onDiscover: () => {} });
    expect(screen.getByRole("heading").textContent).toBe(m.places.emptyFavorisTitle);
    expect(screen.getByRole("button").textContent).toBe(m.places.emptyCtaHotel);
  });

  it.each(locales)("%s — recommandés resto : titre + CTA résolus depuis la vraie locale", (loc, m) => {
    renderState(loc, m, { category: "resto", kind: "recommandes", onDiscover: () => {} });
    expect(screen.getByRole("heading").textContent).toBe(m.places.emptyRecommandesTitle);
    expect(screen.getByRole("button").textContent).toBe(m.places.emptyCtaResto);
  });
});
