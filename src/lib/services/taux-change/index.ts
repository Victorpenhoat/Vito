import { env } from "@/lib/env";
import { FrankfurterTauxProvider } from "./frankfurter";
import { AucunTauxProvider } from "./aucun";
import type { TauxProvider } from "./types";

export function getTauxProvider(): TauxProvider {
  if (env.TAUX_CHANGE_URL) return new FrankfurterTauxProvider(env.TAUX_CHANGE_URL);
  return new AucunTauxProvider();
}

export type { TauxProvider, TauxDeChange } from "./types";
