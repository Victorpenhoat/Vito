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
