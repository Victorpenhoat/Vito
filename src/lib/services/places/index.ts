import { env } from "@/lib/env";
import { MockPlacesProvider } from "./mock";
import { GooglePlacesProvider } from "./google";
import type { PlacesProvider } from "./types";

export function getPlacesProvider(): PlacesProvider {
  if (env.GOOGLE_PLACES_API_KEY) {
    return new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY);
  }
  return new MockPlacesProvider();
}

export type { PlacesProvider, PlaceResult, PlaceSummary } from "./types";
