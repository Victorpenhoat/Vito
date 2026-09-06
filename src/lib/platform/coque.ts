import { headers } from "next/headers";

// Détection de la coque iOS CÔTÉ SERVEUR.
//
// Le pendant de `estNatif()`, qui n'existe qu'une fois la page rendue. Ici, la
// coque s'annonce dans son User-Agent (`appendUserAgent` de capacitor.config),
// ce qui permet de ne pas rendre du tout ce qu'elle ne doit pas montrer —
// plutôt que de le rendre puis de le cacher, avec le clignotement que cela
// suppose.
//
// Le marqueur est ajouté par nous, à un User-Agent que nous contrôlons. Il ne
// sert qu'à masquer une page, jamais à autoriser quoi que ce soit : un
// User-Agent se falsifie, et rien de sensible ne doit en dépendre.
export const MARQUEUR_COQUE = "VitoiOS";

/** Testable sans requête : la logique tient dans cette ligne. */
export function uaEstCoque(ua: string | null | undefined): boolean {
  return typeof ua === "string" && ua.includes(MARQUEUR_COQUE);
}

export async function estDansLaCoque(): Promise<boolean> {
  const h = await headers();
  return uaEstCoque(h.get("user-agent"));
}
