import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const CSS = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");

/** Les déclarations `--role: valeur` d'un bloc, par son sélecteur d'ouverture. */
export function rolesDuBloc(css: string, ouverture: string): Map<string, string> {
  const debut = css.indexOf(ouverture);
  if (debut === -1) throw new Error(`bloc introuvable : ${ouverture}`);
  const accolade = css.indexOf("{", debut);
  const fin = css.indexOf("\n}", accolade);
  // Un commentaire peut citer un rôle (ex. « jadis : --hero-glow: … retiré »)
  // sans le déclarer : on le retire avant d'extraire les déclarations actives,
  // sinon ce rôle fantôme est pris pour une déclaration réelle.
  const corps = css.slice(accolade + 1, fin).replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, string>();
  for (const m of corps.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1]!, m[2]!.trim());
  return out;
}

describe("la table des jetons", () => {
  const sombre = rolesDuBloc(CSS, ':root,\n[data-theme="dark"]');
  const clair = rolesDuBloc(CSS, '[data-theme="light"]');

  // Un rôle défini d'un seul côté laisse une variable VIDE dans l'autre thème :
  // un texte invisible, un fond transparent. Ça ne se voit pas à la relecture,
  // et ça ne casse aucun test d'écran.
  it("définit exactement les mêmes rôles dans les deux thèmes", () => {
    const cle = (m: Map<string, string>) => [...m.keys()].filter((k) => k !== "color-scheme").sort();
    expect(cle(sombre)).toEqual(cle(clair));
  });

  it("porte les trois rôles ajoutés par la refonte v3", () => {
    for (const role of ["on-fill", "shadow"]) {
      expect(sombre.has(role), `--${role} manque au thème sombre`).toBe(true);
      expect(clair.has(role), `--${role} manque au thème clair`).toBe(true);
    }
    expect(CSS).toContain("--radius-pill:");
  });

  // Chaque rôle de couleur doit être exposé à Tailwind, sinon il est déclaré
  // pour rien et personne ne s'en aperçoit.
  it("expose à @theme tout rôle de couleur des blocs", () => {
    const exposes = new Set([...CSS.matchAll(/--color-[a-z0-9-]+:\s*var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]!));
    const couleurs = [...sombre.keys()].filter((k) => !k.startsWith("radius") && k !== "color-scheme");
    expect(couleurs.filter((c) => !exposes.has(c))).toEqual([]);
  });
});

const canal = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
/** Luminance relative WCAG d'un `#rrggbb`. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
/** Rapport de contraste WCAG entre deux `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (haut + 0.05) / (bas + 0.05);
}

// Les seuils ne sont pas décoratifs : ce sont eux qui ont imposé de NE PAS
// reprendre l'accent #6BA5FF de la maquette dans le thème clair, où il tombe
// à 2,48:1 sur blanc (2,34:1 sur le fond clair #F6F8FC) et échoue largement
// au texte, d'où #2E6FD9 (4,78:1). Une valeur dérivée à l'œil passerait sans eux.
const SEUILS: [string, string, number][] = [
  ["ink", "surface", 7],
  ["muted", "surface", 4.5],
  ["faint", "surface", 3],
  ["accent", "surface", 4.5],
  ["on-fill", "accent", 4.5],
  ["gold", "surface", 3],
  ["danger", "surface", 4.5],
  ["kpi-green", "surface", 4.5],
  ["kpi-amber", "surface", 4.5],
  ["kpi-violet", "surface", 4.5],
];

describe.each([
  ["sombre", ':root,\n[data-theme="dark"]'],
  ["clair", '[data-theme="light"]'],
])("contrastes du thème %s", (_nom, ouverture) => {
  const roles = rolesDuBloc(CSS, ouverture);
  it.each(SEUILS)("%s sur %s tient %s:1", (avant, fond, seuil) => {
    const [a, b] = [roles.get(avant)!, roles.get(fond)!];
    expect(a, `--${avant} absent`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(b, `--${fond} absent`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(contraste(a, b)).toBeGreaterThanOrEqual(seuil);
  });
});

describe("rolesDuBloc face à un commentaire", () => {
  // Un rôle cité dans un commentaire (ex. « jadis : --hero-glow: … retiré »)
  // ne doit pas être confondu avec une déclaration active : ni ajouté comme
  // rôle existant, ni signalé comme rôle manquant ou orphelin ailleurs.
  it("ne retient pas un rôle mentionné seulement dans un commentaire", () => {
    const css = `
      :root {
        --vrai: 1px;
        /* jadis : --hero-glow: #4F8BF0; retiré en 2025 */
        --autre: 2px;
      }
    `;
    const roles = rolesDuBloc(css, ":root");
    expect(roles.has("hero-glow")).toBe(false);
    expect([...roles.keys()].sort()).toEqual(["autre", "vrai"]);
  });
});

describe("les rayons", () => {
  // La v3 est une interface RONDE : le canevas compte 129 rayons à 12px et 153
  // à 999px, là où nos jetons disaient 4px et 3px. L'écart se voit plus que la
  // couleur, et un jeton de rayon ne casse aucune mise en page.
  it("porte les rayons de la refonte v3", () => {
    const rayons = Object.fromEntries(
      [...CSS.matchAll(/--radius-([a-z]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
    );
    expect(rayons).toMatchObject({ card: "12px", tile: "12px", control: "10px", pill: "999px" });
  });
});
