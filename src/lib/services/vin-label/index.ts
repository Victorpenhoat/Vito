import { env } from "@/lib/env";
import { MockVinLabelProvider } from "./mock";
import { AnthropicVinLabelProvider } from "./anthropic";
import type { VinLabelProvider } from "./types";

// Sans clé Anthropic : mock déterministe (tests, e2e, dev hors ligne) — même
// convention que services/ocr et services/places.
export function getVinLabelProvider(): VinLabelProvider {
  if (env.ANTHROPIC_API_KEY) return new AnthropicVinLabelProvider(env.ANTHROPIC_API_KEY);
  return new MockVinLabelProvider();
}

