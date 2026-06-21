import { env } from "@/lib/env";
import { MockEnrichmentProvider } from "./mock";
import type { EnrichmentProvider } from "./types";

export function getEnrichmentProvider(): EnrichmentProvider {
  // Adapter LLM activé seulement si la clé est fournie ET l'enrichissement activé.
  // Tant que ce n'est pas cadré (budget/cache), on reste sur le mock no-op.
  if (env.ANTHROPIC_API_KEY && process.env.VINS_ENRICHMENT === "llm") {
    return new MockEnrichmentProvider(); // placeholder : adapter LLM ajouté plus tard
  }
  return new MockEnrichmentProvider();
}

export type { EnrichmentProvider, VinEnrichmentInput, VinCouleur } from "./types";
