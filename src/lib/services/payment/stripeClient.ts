import Stripe from "stripe";

// Version d'API Stripe épinglée (= défaut du SDK stripe@22). L'expliciter garantit que
// les events reçus par le webhook gardent la même forme même si le SDK est bumpé : un
// bump changerait le défaut, et le littéral ci-dessous ne matcherait plus le type
// `LatestApiVersion` → erreur de typecheck (mise à jour consciente) plutôt que dérive
// silencieuse de la forme des events. Point de construction unique (webhook + provider).
export function createStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: "2026-06-24.dahlia" });
}
