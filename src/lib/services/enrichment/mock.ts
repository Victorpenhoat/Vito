import type { EnrichmentProvider, VinEnrichmentInput } from "./types";

const clean = (s: string | null): string | null => {
  if (s === null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
};

// Mock no-op : nettoie/trim seulement, n'invente aucune donnée (zéro coût).
// L'adapter LLM (Anthropic) / API vin sera branché plus tard derrière cette interface.
export class MockEnrichmentProvider implements EnrichmentProvider {
  readonly name = "mock";
  async normalize(input: VinEnrichmentInput): Promise<VinEnrichmentInput> {
    return {
      nom: input.nom.trim(),
      domaine: clean(input.domaine),
      millesime: input.millesime,
      region: clean(input.region),
      couleur: input.couleur,
      cepages: input.cepages.map((c) => c.trim()).filter((c) => c.length > 0),
    };
  }
}
