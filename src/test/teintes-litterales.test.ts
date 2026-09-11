import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources, sansCommentaires } from "./fichiersSources";

// Liste CLOSE, chaque entrée avec sa raison. C'est une liste de FICHIERS et non
// un motif : un nouveau fichier qui code une teinte doit faire échouer ce test
// et obliger à l'ajouter consciemment, ou à employer un jeton.
const AUTORISES: Record<string, string> = {
  "app/globals.css": "la table des jetons elle-même",
  "app/[locale]/carnet-hors-ligne/[id]/page.tsx":
    "page hors du groupe (app) : elle n'hérite pas de globals.css et embarque ses styles",
  "features/voyages/domain/statutTint.ts": "palette délibérée, pas des rôles d'interface",
  "features/vins/domain/couleurTint.ts": "palette délibérée, pas des rôles d'interface",
  "features/famille/domain/avatarColor.ts": "palette délibérée, pas des rôles d'interface",
  "features/restos/ui/TagsAdmin.tsx": "couleur de tag choisie par l'utilisateur, et son défaut",
  "app/[locale]/layout.tsx":
    "themeColor est une valeur de balise meta : elle ne peut pas être une variable CSS",
};

// Pas de `\b` devant `rgba` : Tailwind sépare ses valeurs arbitraires par des
// blancs soulignés (`16px_rgba(...)`), et `_` est un caractère de mot — la
// limite ne mordrait donc pas, et TOUTE la famille des ombres passerait au
// travers. Ce piège a été mesuré en écrivant ce plan, pas supposé.
// `{3,6}` et non `{6}` : une notation courte est une teinte comme une autre, et
// quatre `#fff` ont vécu dans des pastilles de carte sans que ce test les voie.
// Deux d'entre eux posaient du blanc sur l'accent — 2,48:1.
const TEINTE = /#[0-9A-Fa-f]{3,6}(?![0-9A-Fa-f])|rgba?\(\s*\d/;

describe("aucune teinte littérale hors de la table", () => {
  it("ne trouve de couleur en dur que dans les fichiers autorisés", () => {
    const coupables = fichiersSources()
      .filter((f) => !(f in AUTORISES))
      .filter((f) => TEINTE.test(sansCommentaires(readFileSync(path.join(SRC, f), "utf8"))))
      .sort();
    expect(coupables).toEqual([]);
  });

  // Un rayon en dur ne suit pas la table : c'est ainsi que l'app s'est
  // retrouvée avec 79 valeurs figées entre 2 et 8 px pendant que les jetons
  // passaient à 12. Les `border-radius` inline des marqueurs Leaflet et de la
  // page hors ligne ne sont pas concernés : ils vivent hors de Tailwind.
  it("ne laisse aucun rayon littéral dans une classe Tailwind", () => {
    const coupables = fichiersSources()
      .filter((f) => /rounded-\[/.test(sansCommentaires(readFileSync(path.join(SRC, f), "utf8"))))
      .sort();
    expect(coupables).toEqual([]);
  });
});
