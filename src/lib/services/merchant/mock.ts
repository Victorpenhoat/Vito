import type { MerchantProvider, VinAchat } from "./types";

// Mock : URL de recherche placeholder, AUCUNE affiliation/revenu. Le partenaire réel
// (adapter dédié) sera branché plus tard derrière la même interface.
export class MockMerchantProvider implements MerchantProvider {
  readonly name = "mock";
  buyUrl(vin: VinAchat, quantity: number): string | null {
    if (!vin.nom.trim()) return null;
    // Math.max gère 0 et négatifs ; `|| 0` neutralise NaN avant le plancher à 1.
    const qty = Math.max(1, Math.floor(quantity) || 0);
    // couleur volontairement exclue : trop restrictive pour une recherche marchand.
    const terms = [vin.nom, vin.domaine, vin.millesime].filter(Boolean).join(" ");
    return `https://marchand.example/search?q=${encodeURIComponent(terms)}&qty=${qty}`;
  }
}
