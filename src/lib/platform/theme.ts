import { cookies } from "next/headers";

// Le défaut de thème, décidé UNE SEULE FOIS. `[locale]/layout.tsx` (toutes les
// routes applicatives) et `global-not-found.tsx` (qui contourne ce layout et
// porte sa propre coque HTML, cf. son commentaire) doivent servir le MÊME
// html au premier octet, cookie absent ou non. Deux copies de cette décision
// avaient déjà divergé une fois — 404 clair au milieu d'une app sombre — d'où
// ce module : une troisième copie aurait divergé pareil.
export type Theme = "light" | "dark";

// Le SOMBRE est le défaut depuis la refonte v3 (décision PO du 2026-09-11) :
// toutes les maquettes du canevas sont sombres, et le clair n'y est qu'une
// contrepartie que le designer a explicitement reportée. Le clair reste à un
// clic, et le choix est mémorisé par le cookie.
const DEFAUT: Theme = "dark";

/** Testable sans requête : la logique tient dans cette ligne. */
export function themeDepuisCookie(valeurCookie: string | undefined): Theme {
  const contraire: Theme = DEFAUT === "dark" ? "light" : "dark";
  return valeurCookie === contraire ? contraire : DEFAUT;
}

/** Lit le cookie `theme` de la requête en cours et applique le défaut. */
export async function themeServeur(): Promise<Theme> {
  const cookieStore = await cookies();
  return themeDepuisCookie(cookieStore.get("theme")?.value);
}
