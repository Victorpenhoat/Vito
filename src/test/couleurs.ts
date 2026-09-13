import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Les outils de mesure du contraste, partagés par les garde-fous.
 *
 * Ils vivaient dans `src/app/theme.test.ts`. Un second garde-fou en a désormais
 * besoin — celui qui mesure les paires fond/texte réellement écrites dans le
 * code — et deux copies de ces fonctions finiraient par mesurer différemment
 * sans que rien ne le signale.
 */
export const CSS = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

/** Les déclarations `--role: valeur` d'un bloc, par son sélecteur d'ouverture. */
export function rolesDuBloc(css: string, ouverture: string): Map<string, string> {
  const debut = css.indexOf(ouverture);
  if (debut === -1) throw new Error(`bloc introuvable : ${ouverture}`);
  const accolade = css.indexOf("{", debut);
  const fin = css.indexOf("\n}", accolade);
  // Un commentaire peut citer un rôle sans le déclarer : on le retire avant
  // d'extraire, sinon ce rôle fantôme est pris pour une déclaration réelle.
  const corps = css.slice(accolade + 1, fin).replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, string>();
  for (const m of corps.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1]!, m[2]!.trim());
  return out;
}

export const THEMES = {
  sombre: rolesDuBloc(CSS, ':root,\n[data-theme="dark"]'),
  clair: rolesDuBloc(CSS, '[data-theme="light"]'),
} as const;

const canal = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Luminance relative WCAG d'un `#rrggbb`. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/**
 * Une couleur alpha composée sur son fond, rendue en `#rrggbb`.
 *
 * Sans elle, aucun seuil ne pouvait couvrir un fond teinté : `contraste`
 * n'accepte que `#rrggbb`, et les fonds de badge sont en `rgba(…, .14)`. C'est
 * ce trou de l'outil de mesure qui a laissé un libellé teinté écrire à 4,17:1
 * en thème clair sans qu'aucun test ne bronche.
 */
export function surFond(couleur: string, fond: string): string {
  const m = couleur.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (!m) return couleur;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const f = parseInt(fond.slice(1), 16);
  const mele = (i: number, d: number) => Math.round(Number(m[i]) * a + ((f >> d) & 255) * (1 - a));
  return "#" + ([[1, 16], [2, 8], [3, 0]] as const).map(([i, d]) => mele(i, d).toString(16).padStart(2, "0")).join("");
}

/** Rapport de contraste WCAG entre deux `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (haut + 0.05) / (bas + 0.05);
}

/**
 * La valeur opaque d'un rôle dans un thème, éventuellement sous un modificateur
 * d'opacité Tailwind (`bg-accent/95` → `alpha = 95`). Rend `null` pour ce que la
 * mesure ne sait pas lire — un dégradé, une valeur calculée — plutôt que de
 * deviner.
 */
export function valeurRole(role: string, theme: keyof typeof THEMES, alpha?: string): string | null {
  const T = THEMES[theme];
  const surface = T.get("surface")!;
  const brut = T.get(role);
  if (!brut) return null;
  let v = surFond(brut, surface);
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return null;
  if (alpha) {
    const n = parseInt(v.slice(1), 16);
    v = surFond(`rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Number(alpha) / 100})`, surface);
  }
  return v;
}
