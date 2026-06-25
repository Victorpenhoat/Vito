import { describe, it, expect } from "vitest";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import itMsg from "../../../messages/it.json";
import es from "../../../messages/es.json";

type Json = { [k: string]: unknown };

function leaves(obj: Json, prefix = "", acc: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") leaves(v as Json, path, acc);
    else acc[path] = String(v);
  }
  return acc;
}
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
}

const frLeaves = leaves(fr as Json);
const frKeys = Object.keys(frLeaves).sort();

describe.each([
  ["en", en],
  ["it", itMsg],
  ["es", es],
])("parité i18n %s", (name, locale) => {
  const locLeaves = leaves(locale as Json);
  it("a exactement le jeu de clés de fr", () => {
    expect(Object.keys(locLeaves).sort()).toEqual(frKeys);
  });
  it("préserve les placeholders ICU de chaque clé", () => {
    for (const k of frKeys) {
      expect(placeholders(locLeaves[k] ?? "")).toEqual(placeholders(frLeaves[k]!));
    }
  });
});
