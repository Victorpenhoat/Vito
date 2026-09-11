import { describe, it, expect, vi } from "vitest";

// `theme.ts` importe `next/headers` pour `themeServeur`. La fonction éprouvée
// ici n'en a pas besoin, mais l'import est évalué au chargement du module.
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));

const { themeDepuisCookie } = await import("./theme");

describe("le défaut de thème", () => {
  // La décision PO du 2026-09-11 — le SOMBRE est le défaut — ne se lit nulle
  // part ailleurs que dans une constante. Sans ce test, l'inverser resterait
  // silencieux : aucune page ne casse quand un thème en remplace un autre.
  it("sert le sombre quand aucun cookie ne dit le contraire", () => {
    expect(themeDepuisCookie(undefined)).toBe("dark");
    expect(themeDepuisCookie("dark")).toBe("dark");
  });

  it("ne cède au clair que sur demande explicite", () => {
    expect(themeDepuisCookie("light")).toBe("light");
  });

  // Un cookie est une chaîne venue du client : il peut porter n'importe quoi.
  // Une valeur inconnue doit retomber sur le défaut, pas laisser le thème vide.
  it("retombe sur le défaut devant une valeur qu'il ne connaît pas", () => {
    for (const valeur of ["sombre", "", "DARK", "auto"]) {
      expect(themeDepuisCookie(valeur), `cookie « ${valeur} »`).toBe("dark");
    }
  });
});
