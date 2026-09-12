import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources } from "./fichiersSources";
import { RAISONS } from "./pastilles-raisons";

// Une pastille dessinée à la main est la dette que le lot 6 supprime. Ce test
// raisonne au SITE et non au fichier : la version par fichier ne pouvait rien
// dire d'un fichier mêlant une pastille migrable et une pastille légitime — il
// serait resté en dette pour toujours, ou aurait perdu toute surveillance.
//
// Le marqueur a d'abord été tenté EN LIGNE, au-dessus de chaque pastille. Deux
// obstacles l'ont fait abandonner : 43 des 106 sites portent leur balise et leur
// `className` sur la même ligne, et un commentaire JSX glissé entre `{cond && (`
// et son unique expression est une erreur de syntaxe. La raison vit donc dans
// `pastilles-raisons.ts`, ordonnée par ligne — un fichier de moins contre le
// code, mais un mécanisme qui ne casse pas.
const PASTILLE = /rounded-(pill|full)[^>]{0,200}?\bpx-|\bpx-[^>]{0,200}?rounded-(pill|full)/;

// Baissé par chaque lot qui migre ; jamais relevé sans que le message de commit
// dise pourquoi. Déclaré AVANT son usage, et pas en fin de fichier : le laisser
// en bas marcherait, mais c'est le genre de subtilité qui coûte une relecture.
const PLAFOND_DETTE = 54; // relevé le 2026-09-12, fin du lot 6B-2

/** Les lignes où chaque fichier dessine une pastille à la main. */
function sitesParFichier(): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const f of fichiersSources()) {
    if (!f.startsWith("features/") && !f.startsWith("app/")) continue;
    const lignes: number[] = [];
    readFileSync(path.join(SRC, f), "utf8")
      .split("\n")
      .forEach((l, i) => PASTILLE.test(l) && lignes.push(i + 1));
    if (lignes.length > 0) out.set(f, lignes);
  }
  return out;
}

describe("les pastilles", () => {
  // C'est le compte qui garde : une pastille ajoutée fait diverger le nombre de
  // sites du nombre de raisons, et oblige à écrire pourquoi elle existe. Une
  // pastille retirée le fait aussi, et oblige à retirer sa raison — sans quoi
  // la liste deviendrait un cimetière.
  it("ont toutes une raison écrite, et pas une de plus", () => {
    const sites = sitesParFichier();
    const ecarts: string[] = [];
    for (const [f, lignes] of sites) {
      const r = RAISONS[f];
      if (!r) ecarts.push(`${f} : ${lignes.length} pastille(s), AUCUNE raison (lignes ${lignes.join(", ")})`);
      else if (r.length !== lignes.length)
        ecarts.push(`${f} : ${lignes.length} pastille(s) aux lignes ${lignes.join(", ")}, ${r.length} raison(s)`);
    }
    for (const f of Object.keys(RAISONS)) {
      if (!sites.has(f)) ecarts.push(`${f} : des raisons, mais plus aucune pastille — les retirer`);
    }
    expect(ecarts).toEqual([]);
  });

  // La dette doit DESCENDRE. C'est le seul endroit où l'on voit qu'un lot a
  // réellement payé quelque chose plutôt que d'avoir déplacé des étiquettes.
  it("ne laissent pas la dette remonter", () => {
    const enDette = Object.values(RAISONS)
      .flat()
      .filter((r) => r.startsWith("dette:")).length;
    expect(enDette).toBeLessThanOrEqual(PLAFOND_DETTE);
  });
});
