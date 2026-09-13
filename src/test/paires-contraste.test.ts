import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources } from "./fichiersSources";
import { THEMES, contraste, valeurRole } from "./couleurs";

/**
 * Le contraste des paires fond/texte TELLES QU'ELLES SONT ÉCRITES.
 *
 * Les autres garde-fous tiennent la TABLE des jetons, ou interdisent une chaîne
 * précise (`text-white`, une teinte littérale). Aucun ne mesurait une paire
 * telle qu'un écran la compose — et c'est ce qui a manqué trois fois : blanc sur
 * accent (2,48:1), blanc sur --ink (1,12:1), puis une teinte sur sa propre
 * teinte (4,17:1). Chaque fois, la table était irréprochable et l'usage fautif.
 */

// Le seuil dépend du RÔLE du texte, pas d'une règle unique. `--faint` porte des
// légendes et des libellés désactivés : le lot 0 lui fixe 3:1, et l'aligner sur
// 4,5 ferait échouer un usage correct. Les autres portent du texte courant.
const SEUIL: Record<string, number> = { faint: 3 };
const SEUIL_DEFAUT = 4.5;

// Les rôles du plus long au plus court : sinon `bg-accent-50` est lu
// `bg-accent`, et la mesure porte sur la mauvaise couleur.
const ROLES = [...THEMES.sombre.keys()]
  .filter((k) => k !== "color-scheme" && !k.startsWith("radius"))
  .sort((a, b) => b.length - a.length);
const RE_BG = new RegExp(`\\bbg-(${ROLES.join("|")})(?:/(\\d+))?(?![\\w-])`, "g");
const RE_TXT = new RegExp(`\\btext-(${ROLES.join("|")})(?![\\w-])`, "g");

type Faute = { site: string; paire: string; theme: string; mesure: string; seuil: number };

function fautes(): Faute[] {
  const out: Faute[] = [];
  for (const f of fichiersSources()) {
    if (!f.endsWith(".tsx")) continue;
    readFileSync(path.join(SRC, f), "utf8").split("\n").forEach((ligne, i) => {
      // Un ternaire pose ses DEUX branches sur la même ligne : apparier au
      // niveau de la ligne ferait croire que `bg-ink` (branche active) compose
      // avec `text-ink` (branche inactive), soit 1,00:1 — un faux positif qui
      // noierait les vrais. On n'apparie donc qu'à l'intérieur d'un segment.
      for (const seg of ligne.split(/[?:]/)) {
        const fonds = [...seg.matchAll(RE_BG)];
        const textes = [...seg.matchAll(RE_TXT)];
        if (fonds.length === 0 || textes.length === 0) continue;
        for (const bg of fonds) {
          for (const tx of textes) {
            for (const theme of ["sombre", "clair"] as const) {
              const b = valeurRole(bg[1]!, theme, bg[2]);
              const a = valeurRole(tx[1]!, theme);
              if (!a || !b) continue;
              const seuil = SEUIL[tx[1]!] ?? SEUIL_DEFAUT;
              const c = contraste(a, b);
              if (c >= seuil) continue;
              out.push({
                site: `${f}:${i + 1}`,
                paire: `text-${tx[1]} sur bg-${bg[1]}${bg[2] ? "/" + bg[2] : ""}`,
                theme,
                mesure: c.toFixed(2),
                seuil,
              });
            }
          }
        }
      }
    });
  }
  return out;
}

describe("les paires fond/texte écrites dans le code", () => {
  it("tiennent toutes leur seuil, dans les deux thèmes", () => {
    const liste = fautes()
      .map((d) => `${d.site} — ${d.paire} [${d.theme}] ${d.mesure}:1 < ${d.seuil}`)
      .sort();
    expect(liste).toEqual([]);
  });
});
