import { env } from "@/lib/env";
import { MockMerchantProvider } from "./mock";
import type { MerchantProvider } from "./types";

export function getMerchantProvider(): MerchantProvider {
  // Adapter réel branché ici quand MERCHANT_PARTNER_URL sera défini (env étendu en temps voulu).
  if (env.MERCHANT_PARTNER_URL) {
    // Placeholder : le vrai adapter affilié sera ajouté avec son ToS. En attendant, mock.
    return new MockMerchantProvider();
  }
  return new MockMerchantProvider();
}

export type { MerchantProvider, VinAchat } from "./types";
