import type { TauxDeChange, TauxProvider } from "./types";

const CODE = /^[A-Z]{3}$/;

// Frankfurter : les taux de référence de la BCE, publiés chaque jour ouvré et
// interrogeables par date. Gratuit et sans clé — ce sont des données publiques.
//
// Ce sont des taux de RÉFÉRENCE, pas ceux de ta banque : une carte prend
// généralement 1 à 3 % de plus. D'où la correction manuelle offerte à côté.
export class FrankfurterTauxProvider implements TauxProvider {
  readonly name = "frankfurter";
  constructor(private readonly baseUrl: string) {}

  async taux(de: string, vers: string, date: string): Promise<TauxDeChange | null> {
    if (!CODE.test(de) || !CODE.test(vers)) return null;
    // Même devise : le taux est 1, sans appel réseau ni date à corriger.
    if (de === vers) return { taux: 1, date };

    const url = `${this.baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(date)}?base=${de}&symbols=${vers}`;
    let res: Response;
    try {
      // Un taux est un CONFORT : mieux vaut le demander à l'utilisateur que
      // faire attendre l'enregistrement de sa dépense.
      res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    } catch {
      return null;
    }
    if (!res.ok) return null;

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return null;
    }
    const corps = json as { rates?: Record<string, unknown>; date?: unknown } | null;
    const taux = corps?.rates?.[vers];
    if (typeof taux !== "number" || !Number.isFinite(taux) || taux <= 0) return null;
    return { taux, date: typeof corps?.date === "string" ? corps.date : date };
  }
}
