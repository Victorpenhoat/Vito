# Refonte v3 — lot 0 : bascule des jetons — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire passer toute l'application à la palette froide de la refonte v3, sombre par défaut, sans reconstruire un seul composant.

**Architecture:** Le dépôt porte déjà deux palettes complètes nommées par leur rôle dans `src/app/globals.css` (`:root` sombre, `[data-theme="light"]` clair) et les expose à Tailwind par `@theme`. Ce lot réassigne les valeurs de ces deux blocs, ajoute trois rôles manquants (`--on-fill`, `--shadow`, `--radius-pill`), inverse le défaut du layout, et remplace par des jetons la quarantaine de teintes codées en dur. Deux tests d'invariant empêchent la dérive : parité des rôles entre les deux blocs, et interdiction des teintes littérales hors d'une liste close.

**Tech Stack:** Next.js App Router, Tailwind v4 (`@theme`), Vitest (jsdom, `src/**/*.test.{ts,tsx}`), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-refonte-v3-lot0-jetons-design.md`

## Global Constraints

- **On dé-littéralise, on ne réassigne pas le sens.** Une teinte en dur devient le jeton qui lui correspond ; elle ne change pas de signification. Le marqueur « testé » prend `--faint` et **reste gris** ; son passage au vert appartient au lot 4. Le favori reste `text-gold` ; son passage à l'accent appartient au lot des composants.
- **Aucun composant n'est reconstruit** dans ce lot.
- **Les vingt-sept `text-white` sur `bg-accent` ne sont PAS remplacés** : le jeton `--on-fill` est créé et documenté, son emploi appartient aux lots de composants.
- Code, commentaires et messages de commit **en français**.
- Les tests unitaires vivent sous `src/**/*.test.ts` (contrainte de `vitest.config.ts`).
- Vérification avant chaque commit : `npm run lint`, `npx tsc --noEmit`, `npm test`. La CI `quality` échoue sur eslint sinon.
- `npm install` échoue dans cet environnement (cache npm appartenant à root). **N'installe aucune dépendance** : tout ce plan s'écrit avec `node:fs` et `node:path`.
- Pour tout test qui garde une propriété : **casse la propriété, montre le rouge, remets-la, montre le vert**, et recopie les deux sorties dans ton rapport.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/app/globals.css` (modifier) | La table des jetons — les deux blocs de thème et `@theme` |
| `src/app/theme.test.ts` (créer) | Invariants de la table : parité des rôles, contrastes WCAG |
| `src/test/teintes-litterales.test.ts` (créer) | Interdit les teintes en dur hors liste close |
| `src/app/[locale]/layout.tsx` (modifier) | Défaut sombre + `themeColor` |
| `src/features/shared/ui/ThemeToggle.tsx` (modifier) | État initial cohérent avec le défaut |
| `src/features/voyages/domain/statutTint.ts` (modifier) | Dégradés de couverture, retendus en froid |
| `src/features/vins/domain/couleurTint.ts` (modifier) | Dégradés de couleur de vin, retendus |
| `src/features/famille/domain/avatarColor.ts` (modifier) | Palette d'avatars, retendue |
| `src/app/[locale]/carnet-hors-ligne/[id]/page.tsx` (modifier) | Table dupliquée, retendue |
| 12 fichiers d'UI (modifier) | Ombres : `var(--color-shadow)` / accent |

---

### Task 1 : les trois rôles manquants, et le test qui tient la parité

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/app/theme.test.ts` (créer)

**Interfaces:**
- Consumes: rien.
- Produces: les jetons CSS `--on-fill`, `--shadow`, `--radius-pill`, utilisables en Tailwind sous `text-on-fill` / `bg-on-fill`, `var(--color-shadow)`, `rounded-pill`. Et surtout `rolesDuBloc(css, ouverture): Map<string, string>`, exportée par `src/app/theme.test.ts` : **les tâches 2, 4 et 8 l'importent telle quelle**, sa signature ne doit plus bouger.

- [ ] **Step 1 : écrire le test de parité qui échoue**

Créer `src/app/theme.test.ts` :

```ts
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
  const corps = css.slice(accolade + 1, fin);
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
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

Run : `npx vitest run src/app/theme.test.ts`
Expected : FAIL — « `--on-fill` manque au thème sombre ». Le test de parité, lui, doit déjà passer : c'est normal, il garde un invariant qui tient aujourd'hui.

- [ ] **Step 3 : ajouter les trois rôles**

Dans `src/app/globals.css`, bloc `:root, [data-theme="dark"]`, après la ligne `--ink: … --faint: …` :

```css
  --on-fill: #0A1220; --shadow: rgba(0,0,0,.5);
```

Dans le bloc `[data-theme="light"]`, au même endroit :

```css
  --on-fill: #FFFFFF; --shadow: rgba(16,24,40,.12);
```

Dans `@theme`, avec les autres couleurs :

```css
  --color-on-fill: var(--on-fill);
  --color-shadow: var(--shadow);
```

Et avec les rayons :

```css
  --radius-pill: 999px;
```

- [ ] **Step 4 : lancer le test et vérifier qu'il passe**

Run : `npx vitest run src/app/theme.test.ts`
Expected : PASS (3 tests).

- [ ] **Step 5 : prouver que la parité est réellement tenue**

Retirer temporairement `--shadow: rgba(16,24,40,.12);` du bloc clair, relancer.
Expected : FAIL sur « définit exactement les mêmes rôles ». Remettre, relancer, PASS. Recopier les deux sorties dans le rapport.

- [ ] **Step 6 : commit**

```bash
git add src/app/globals.css src/app/theme.test.ts
git commit -m "feat(design): trois rôles que la refonte v3 réclame, et la parité tenue par un test"
```

---

### Task 2 : la table sombre passe au froid

**Files:**
- Modify: `src/app/globals.css` (bloc `:root, [data-theme="dark"]`)
- Test: `src/app/theme.test.ts` (étendre)

**Interfaces:**
- Consumes: `rolesDuBloc` de la tâche 1.
- Produces: rien de nouveau — les mêmes noms de rôles, d'autres valeurs.

- [ ] **Step 1 : écrire le test de contraste qui échoue**

Ajouter à `src/app/theme.test.ts` :

```ts
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
// à 3,0:1 sur blanc. Une valeur dérivée à l'œil passerait sans eux.
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
```

- [ ] **Step 2 : lancer et vérifier l'échec**

Run : `npx vitest run src/app/theme.test.ts`
Expected : FAIL sur **une seule ligne**, mesurée le 2026-09-11 : « gold sur surface tient 3:1 » dans le thème clair — l'actuel `--gold: #E9B949` ne donne que **1,83:1** sur blanc. Tout le reste de l'ancienne table passe déjà (`accent` 5,17, `muted` 4,68, `faint` 3,14, `ink` 16,6). Si tu vois d'autres lignes rouges, quelque chose a bougé depuis : lis-les avant de continuer.

Cette unique ligne rouge est une bonne nouvelle, pas un contretemps : elle prouve que le seuil mord réellement sur des valeurs réelles, avant même qu'on ait changé la table.

- [ ] **Step 3 : réécrire le bloc sombre**

Remplacer intégralement le corps de `:root, [data-theme="dark"]` dans `src/app/globals.css` :

```css
:root,
[data-theme="dark"] {
  /* Les widgets natifs (icône du date-picker, dropdowns de select, scrollbars)
     suivent le thème — sinon ils restent clairs sur fond sombre. */
  color-scheme: dark;
  /* Palette de la refonte v3, relevée dans le canevas et non devinée :
     cf. docs/superpowers/specs/2026-09-11-refonte-v3-lot0-jetons-design.md */
  --app: #080D16; --sidebar: #0C121D;
  --surface: #131A26; --surface-hover: #1C2432;
  --line: rgba(255,255,255,0.08); --line-soft: rgba(255,255,255,0.06);
  --accent: #6BA5FF; --accent-hover: #8FBCFF;
  --accent-50: rgba(107,165,255,0.14); --accent-600: #8FBCFF;
  --ink: #EEF2F9; --muted: #93A0B8; --faint: #6E7C95;
  --on-fill: #0A1220; --shadow: rgba(0,0,0,.5);
  --badge: #232D3E; --gold: #E9B949; --danger: #F2707F; --danger-bg: rgba(242,112,127,0.14);
  --kpi-green: #3ED598; --kpi-green-bg: rgba(62,213,152,0.14);
  --kpi-blue: #6BA5FF; --kpi-blue-bg: rgba(107,165,255,0.14);
  --kpi-amber: #F5A65B; --kpi-amber-bg: rgba(245,166,91,0.14);
  --kpi-violet: #C9A0F5; --kpi-violet-bg: rgba(201,160,245,0.14);
  --hero-from: #1C2432; --hero-to: #080D16;
}
```

- [ ] **Step 4 : vérifier que le thème sombre passe**

Run : `npx vitest run src/app/theme.test.ts -t "thème sombre"`
Expected : PASS sur les dix lignes du thème sombre. Le thème clair reste rouge — c'est la tâche 3.

- [ ] **Step 5 : commit**

```bash
git add src/app/globals.css src/app/theme.test.ts
git commit -m "feat(design): la table sombre prend la palette froide de la refonte v3"
```

---

### Task 3 : la table claire, contrepartie froide

**Files:**
- Modify: `src/app/globals.css` (bloc `[data-theme="light"]`)

**Interfaces:**
- Consumes: le test de contraste de la tâche 2, tel quel.
- Produces: rien de nouveau.

- [ ] **Step 1 : réécrire le bloc clair**

```css
[data-theme="light"] {
  color-scheme: light;
  /* Contrepartie FROIDE de la palette v3. Le designer a reporté le clair ; on
     le garde tenable en réassignant la table, pas en le redessinant. Les
     valeurs ne sont pas celles du sombre inversées : l'accent #6BA5FF tombe à
     3,0:1 sur blanc et échoue au texte, d'où #2E6FD9. */
  --app: #F6F8FC; --sidebar: #EDF1F8;
  --surface: #FFFFFF; --surface-hover: #EDF1F8;
  --line: #DCE3ED; --line-soft: #EAEFF6;
  --accent: #2E6FD9; --accent-hover: #1F57B4;
  --accent-50: #E8F0FE; --accent-600: #1F57B4;
  --ink: #0A1220; --muted: #55617A; --faint: #7C8799;
  --on-fill: #FFFFFF; --shadow: rgba(16,24,40,.12);
  --badge: #EAEFF6; --gold: #A97A10; --danger: #B3261E; --danger-bg: #FDECEA;
  --kpi-green: #10814F; --kpi-green-bg: #E6F5EE;
  --kpi-blue: #2E6FD9; --kpi-blue-bg: #E8F0FE;
  --kpi-amber: #A85F18; --kpi-amber-bg: #FBEEE2;
  --kpi-violet: #7B3FBF; --kpi-violet-bg: #F1E9FB;
  --hero-from: #DCE3ED; --hero-to: #F6F8FC;
}
```

- [ ] **Step 2 : lancer tout le fichier de test**

Run : `npx vitest run src/app/theme.test.ts`
Expected : PASS, 23 tests (3 d'invariant + 2 × 10 de contraste).

- [ ] **Step 3 : prouver que le seuil mord**

Remettre temporairement `--accent: #6BA5FF;` dans le bloc clair, relancer.
Expected : FAIL sur « accent sur surface tient 4.5:1 » (≈ 3,0). Remettre `#2E6FD9`, PASS. Recopier les deux sorties.

- [ ] **Step 4 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add src/app/globals.css
git commit -m "feat(design): le mode clair devient une contrepartie froide, contrastes vérifiés"
```

---

### Task 4 : les rayons

**Files:**
- Modify: `src/app/globals.css` (bloc `@theme`)
- Test: `src/app/theme.test.ts` (étendre)

**Interfaces:**
- Consumes: rien.
- Produces: `rounded-pill` utilisable en Tailwind.

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter à `src/app/theme.test.ts` :

```ts
// La v3 est une interface RONDE : le canevas compte 129 rayons à 12px et 153
// à 999px, là où nos jetons disaient 4px et 3px. L'écart se voit plus que la
// couleur, et un jeton de rayon ne casse aucune mise en page.
it("porte les rayons de la refonte v3", () => {
  const rayons = Object.fromEntries(
    [...CSS.matchAll(/--radius-([a-z]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
  expect(rayons).toMatchObject({ card: "12px", tile: "12px", control: "10px", pill: "999px" });
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

Run : `npx vitest run src/app/theme.test.ts -t "rayons"`
Expected : FAIL — `card` vaut `4px`, `control` vaut `3px`.

- [ ] **Step 3 : changer les rayons**

Dans `@theme` de `src/app/globals.css` :

```css
  --radius-card: 12px;
  --radius-tile: 12px;
  --radius-control: 10px;
  --radius-pill: 999px;
```

- [ ] **Step 4 : vérifier**

Run : `npx vitest run src/app/theme.test.ts`
Expected : PASS.

- [ ] **Step 5 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add src/app/globals.css src/app/theme.test.ts
git commit -m "feat(design): les rayons de la refonte v3 — la v3 est ronde, nous étions carrés"
```

---

### Task 5 : le sombre devient le défaut

**Files:**
- Modify: `src/app/[locale]/layout.tsx:23-33` (`viewport`) et `:49-53` (choix du thème)
- Modify: `src/features/shared/ui/ThemeToggle.tsx:8`
- Modify: `e2e/navigation.spec.ts:26`
- Modify: `e2e/ui-kit.spec.ts:9-17`

**Interfaces:**
- Consumes: la table de la tâche 2 (`--app` sombre vaut `#080D16`).
- Produces: `<html data-theme="dark">` en l'absence de cookie.

- [ ] **Step 1 : inverser le défaut du layout**

Dans `src/app/[locale]/layout.tsx`, remplacer le bloc de choix du thème (lignes 49-53) :

```tsx
  // Le SOMBRE est le défaut depuis la refonte v3 (décision PO du 2026-09-11) :
  // toutes les maquettes du canevas sont sombres, et le clair n'y est qu'une
  // contrepartie que le designer a explicitement reportée. Le clair reste à un
  // clic, et le choix est mémorisé par le cookie.
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
```

- [ ] **Step 2 : corriger le `themeColor`**

Remplacer les lignes 24-27 :

```tsx
  // Le fond du carnet, pas un gris arbitraire : c'est cette couleur que
  // remplissent la barre d'état iOS et la barre d'onglets Android autour de
  // l'app. Valeur du thème SOMBRE, qui est le défaut ; notre thème vient d'un
  // cookie et non du réglage système, donc un `themeColor` discriminé par
  // `media` ne le suivrait pas. Le lecteur qui choisit le clair garde donc une
  // barre sombre — écart assumé, cf. le spec du lot 0.
  themeColor: "#080D16",
```

- [ ] **Step 3 : corriger l'état initial du commutateur**

Dans `src/features/shared/ui/ThemeToggle.tsx`, ligne 8 :

```tsx
  const [theme, setTheme] = useState<"light" | "dark">("dark");
```

Sans cela l'icône affiche une lune sur une app déjà sombre jusqu'à ce que l'effet post-hydratation la corrige — un clignotement à chaque chargement.

- [ ] **Step 4 : retourner les deux tests e2e existants**

Dans `e2e/navigation.spec.ts:26` :

```ts
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
```

Dans `e2e/ui-kit.spec.ts`, le test « le toggle de thème bascule data-theme sur `<html>` » part maintenant du sombre :

```ts
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
```

- [ ] **Step 5 : ajouter le test du défaut servi**

Ajouter à `e2e/ui-kit.spec.ts` :

```ts
test("sans cookie, le HELIUM servi est déjà sombre", async ({ page, context }) => {
  // On lit le HTML SERVI, pas le DOM : c'est le rendu serveur qui doit être
  // sombre. Si le défaut n'était corrigé qu'après hydratation, la page
  // clignoterait en clair à chaque ouverture et ce test ne le verrait pas.
  await context.clearCookies();
  const reponse = await page.goto("/fr/login");
  const html = await reponse!.text();
  expect(html).toContain('data-theme="dark"');
});
```

- [ ] **Step 6 : lancer les e2e concernés**

Run : `npx playwright test e2e/ui-kit.spec.ts e2e/navigation.spec.ts`
Expected : PASS. Si le nouveau test échoue sur le nom du fichier de route, vérifier qu'une page publique existe bien à `/fr/login`.

- [ ] **Step 7 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add "src/app/[locale]/layout.tsx" src/features/shared/ui/ThemeToggle.tsx e2e/ui-kit.spec.ts e2e/navigation.spec.ts
git commit -m "feat(design): le sombre devient le défaut, et le HTML servi le prouve"
```

---

### Task 6 : les dix-sept ombres teintées

**Files:**
- Modify: `src/features/places/ui/CategoryMap.tsx:30,33,35,51,179,216`
- Modify: `src/features/places/ui/CategoryMapCombined.tsx:52`
- Modify: `src/features/activites/ui/CarteActivites.tsx:35,65,110`
- Modify: `src/features/vins/ui/CaveMap.tsx:24,40,73`
- Modify: `src/features/activites/ui/ChampAdresseClub.tsx:79`
- Modify: `src/features/famille/ui/ReminderToggle.tsx:41`
- Modify: `src/app/[locale]/(app)/voyages/page.tsx:25`
- Modify: `src/app/[locale]/(app)/famille/page.tsx:35`
- Modify: `src/features/places/ui/CategoryTabs.tsx:366`
- Modify: `src/features/famille/ui/ProcheForm.tsx:77`
- Modify: `src/features/famille/ui/ProchesEmptyState.tsx:23`
- Modify: `src/features/famille/ui/DocumentTunnel.tsx:199`

**Interfaces:**
- Consumes: `--shadow` (tâche 1), `--accent` (tâche 2).
- Produces: rien.

**Deux familles, deux remplacements mécaniques.**

*Famille 1 — l'ancienne encre chaude.* Tout `rgba(33,30,26,X)` devient `var(--color-shadow)`, **en laissant tomber l'opacité** : l'opacité est désormais portée par le jeton. `shadow-[0_4px_12px_rgba(33,30,26,.15)]` devient `shadow-[0_4px_12px_var(--color-shadow)]`. Dans les SVG en chaîne, `drop-shadow(0 3px 5px rgba(33,30,26,.35))` devient `drop-shadow(0 3px 5px var(--color-shadow))`.

*Famille 2 — l'ancien accent bleu.* Tout `rgba(37,99,235,X)` devient `color-mix(in srgb, var(--color-accent) 35%, transparent)` pour les `.35` et `30%` pour les `.3` : une ombre d'accent doit suivre l'accent, et `color-mix` est la seule façon d'en tirer une transparence sans figer la valeur.

- [ ] **Step 1 : remplacer la famille 1**

Douze sites. Exemple, `src/features/places/ui/CategoryMap.tsx:179` :

```tsx
      className="absolute bottom-4 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2.5 text-xs font-semibold text-ink shadow-[0_4px_12px_var(--color-shadow)] focus-visible:outline-2 focus-visible:outline-accent"
```

Et `src/features/places/ui/CategoryMap.tsx:30` (SVG en chaîne) :

```ts
    return `<svg width="26" height="33" viewBox="0 0 30 38" style="filter:drop-shadow(0 3px 5px var(--color-shadow));${scale}"><path d="M15 1C7.8 1 2 6.8 2 14c0 9 13 23 13 23s13-14 13-23C28 6.8 22.2 1 15 1Z" fill="var(--accent)"/><circle cx="15" cy="13.5" r="4" fill="var(--color-on-fill)"/></svg>`;
```

Noter le `fill="#fff"` qui passe à `var(--color-on-fill)` : c'est le cas limite décrit au spec, le jeton existe désormais.

- [ ] **Step 2 : remplacer la famille 2**

Six sites. Exemple, `src/app/[locale]/(app)/voyages/page.tsx:25` :

```tsx
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_color-mix(in_srgb,var(--color-accent)_35%,transparent)] transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
```

Le `text-white` **reste** : son remplacement par `text-on-fill` appartient aux lots de composants (contrainte globale).

- [ ] **Step 3 : vérifier qu'il ne reste rien**

```bash
grep -rn --include='*.tsx' --include='*.ts' -e 'rgba(33,30,26' -e 'rgba(37,99,235' src | grep -v '\.test\.'
```

Expected : aucune sortie.

- [ ] **Step 4 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A && git commit -m "fix(design): dix-sept ombres portaient l'ancienne encre chaude et l'ancien bleu"
```

---

### Task 7 : les modules de teintes et les valeurs par défaut

**Files:**
- Modify: `src/features/voyages/domain/statutTint.ts`
- Modify: `src/features/vins/domain/couleurTint.ts`
- Modify: `src/features/famille/domain/avatarColor.ts`
- Modify: `src/features/voyages/ui/VoyageDetail.tsx:126`
- Modify: `src/features/famille/ui/ProchesEmptyState.tsx:17`
- Modify: `src/features/places/ui/CategoryMapCombined.tsx:47`
- Modify: `src/features/places/ui/CategoryMap.tsx:35`
- Modify: `src/features/activites/ui/CarteActivites.tsx:102`
- Modify: `src/features/places/ui/TagPicker.tsx:37`

**Interfaces:**
- Consumes: les jetons de la tâche 2.
- Produces: `AVATAR_PALETTE` garde son nom, son type `readonly string[]` et sa longueur de cinq — `avatarColor` en dépend par index.

- [ ] **Step 1 : retendre `statutTint.ts`**

```ts
// Dégradés de couverture de voyage. Ce ne sont PAS des rôles d'interface —
// ils disent un statut par une ambiance — mais ils doivent vivre dans la même
// famille froide que la refonte v3, sinon une carte de voyage est le seul
// objet chaud d'un écran bleu nuit.
const TINTS: Record<string, string> = {
  confirme: "linear-gradient(135deg,#174436,#1F6B4E)",
  planifie: "linear-gradient(135deg,#1B2B4A,#2A4470)",
  en_preparation: "linear-gradient(135deg,#1B2B4A,#2A4470)",
  idee: "linear-gradient(135deg,#2B3348,#3B4762)",
  en_cours: "linear-gradient(135deg,#4A3A1A,#6E5526)",
  termine: "linear-gradient(135deg,#242C3A,#333D4E)",
};
```

- [ ] **Step 2 : retendre `couleurTint.ts`**

Les couleurs de vin gardent leur teinte — un rouge doit rester rouge — mais descendent en luminosité pour tenir sur `#131A26` :

```ts
const TINTS: Record<string, string> = {
  rouge: "linear-gradient(135deg,#4A1F28,#6B2F3A)",
  blanc: "linear-gradient(135deg,#8F8659,#B0A474)",
  rose: "linear-gradient(135deg,#9A5C6C,#BC7E8E)",
  petillant: "linear-gradient(135deg,#968C5E,#B8AC78)",
};
```

- [ ] **Step 3 : retendre `avatarColor.ts`**

```ts
// Cinq teintes d'avatar, choisies pour se distinguer sur la surface sombre
// #131A26 et entre elles. `#211E1A` (l'encre du thème clair) en faisait
// partie : sur fond nuit, il disparaissait.
export const AVATAR_PALETTE = ["#3E5A8C", "#5C7A99", "#6E5C8C", "#4A7A6B", "#8C6A5C"] as const;
```

- [ ] **Step 4 : retirer les deux `color="#211E1A"`**

`src/features/voyages/ui/VoyageDetail.tsx:126` :

```tsx
                  <Avatar name={m.display_name ?? "?"} size="sm" color={m.role === "owner" ? AVATAR_PALETTE[0] : undefined} />
```

avec `import { AVATAR_PALETTE } from "@/features/famille/domain/avatarColor";`.

`src/features/famille/ui/ProchesEmptyState.tsx:17` : même remplacement, `size="xl"`.

- [ ] **Step 5 : les défauts épars**

`CategoryMapCombined.tsx:47` : `teste: "var(--color-faint)"`.
`CategoryMap.tsx:35` : `fill="#8F867A"` devient `fill="var(--color-faint)"`, et `stroke="#fff"` devient `stroke="var(--color-on-fill)"`.
**Le marqueur reste gris** — son passage au vert appartient au lot 4 (contrainte globale).
`CarteActivites.tsx:102` : `p.membres[0]?.couleur ?? AVATAR_PALETTE[0]`.
`TagPicker.tsx:37` : `{ backgroundColor: "var(--color-badge)" }`.

`TagsAdmin.tsx:104` n'est **pas** touché : `#5B7F5B` y est la couleur par défaut d'un tag que l'utilisateur choisit lui-même, pas un jeton d'interface.

- [ ] **Step 6 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A && git commit -m "fix(design): les palettes délibérées et les défauts épars passent au froid"
```

---

### Task 8 : la table dupliquée du carnet hors ligne

**Files:**
- Modify: `src/app/[locale]/carnet-hors-ligne/[id]/page.tsx:114-121`

**Interfaces:**
- Consumes: les valeurs des tâches 2 et 3, recopiées — cette page ne peut pas les importer.
- Produces: rien.

- [ ] **Step 1 : retendre les deux tables inline**

```ts
// Repli des jetons de l'application. Cette page vit HORS du groupe (app) pour
// que le verrou n'enferme pas le lecteur dehors : elle n'hérite donc pas de
// globals.css et embarque ses styles. Les valeurs doivent rester identiques à
// celles de globals.css — c'est le genre d'écart qui ne se voit qu'en avion.
const CSS = `
.carnet { --c-app:#080D16; --c-surface:#131A26; --c-ink:#EEF2F9; --c-muted:#93A0B8;
  --c-faint:#6E7C95; --c-line:rgba(255,255,255,.08); --c-accent:#6BA5FF;
```

et

```ts
[data-theme="light"] .carnet { --c-app:#F6F8FC; --c-surface:#FFFFFF; --c-ink:#0A1220;
  --c-muted:#55617A; --c-faint:#7C8799; --c-line:#DCE3ED; --c-accent:#2E6FD9; }
```

- [ ] **Step 2 : écrire le test qui empêche les deux tables de diverger**

Ajouter à `src/app/theme.test.ts` :

```ts
// Cette page embarque sa propre copie des jetons (elle vit hors du groupe
// (app) et n'hérite pas de globals.css). Une copie diverge toujours : ce test
// est la seule chose qui l'en empêche.
it("le carnet hors ligne porte les mêmes valeurs que la table", () => {
  const page = readFileSync(
    path.resolve(__dirname, "[locale]/carnet-hors-ligne/[id]/page.tsx"), "utf8");
  for (const [bloc, ouverture] of [
    [".carnet {", ':root,\n[data-theme="dark"]'],
    ['[data-theme="light"] .carnet {', '[data-theme="light"]'],
  ] as const) {
    const roles = rolesDuBloc(CSS, ouverture);
    const debut = page.indexOf(bloc);
    const corps = page.slice(debut, page.indexOf("}", debut));
    for (const m of corps.matchAll(/--c-([a-z-]+)\s*:\s*([^;]+);/g)) {
      expect(m[2]!.trim().toLowerCase(), `--c-${m[1]} diverge`).toBe(roles.get(m[1]!)!.toLowerCase());
    }
  }
});
```

- [ ] **Step 3 : prouver qu'il mord**

Changer une valeur de la page (par exemple `--c-ink:#FFFFFF`), lancer.
Expected : FAIL « --c-ink diverge ». Remettre, PASS. Recopier les deux sorties.

- [ ] **Step 4 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A && git commit -m "fix(design): le carnet emporté suit la table, et un test le lui impose"
```

---

### Task 9 : l'interdiction des teintes littérales

**Files:**
- Test: `src/test/teintes-litterales.test.ts` (créer)

**Interfaces:**
- Consumes: l'état propre laissé par les tâches 6, 7 et 8.
- Produces: rien.

Cette tâche vient en dernier : lancée plus tôt, elle échouerait sur du code que les tâches précédentes n'ont pas encore nettoyé.

- [ ] **Step 1 : écrire le test**

Créer `src/test/teintes-litterales.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..");

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
const TEINTE = /#[0-9A-Fa-f]{6}(?![0-9A-Fa-f])|rgba?\(\s*\d/;

function fichiers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(ts|tsx|css)$/.test(e.name))
    .map((e) => path.relative(SRC, path.join(e.parentPath, e.name)))
    .filter((p) => !/\.(test|stories)\.tsx?$/.test(p));
}

describe("aucune teinte littérale hors de la table", () => {
  it("ne trouve de couleur en dur que dans les fichiers autorisés", () => {
    const coupables = fichiers(SRC)
      .filter((f) => !(f in AUTORISES))
      .filter((f) => TEINTE.test(readFileSync(path.join(SRC, f), "utf8")))
      .sort();
    expect(coupables).toEqual([]);
  });
});
```

- [ ] **Step 2 : lancer**

Run : `npx vitest run src/test/teintes-litterales.test.ts`
Expected : PASS. S'il échoue, la liste des coupables dit exactement quels fichiers les tâches 6 à 8 ont manqués — les corriger plutôt que d'élargir la liste.

Repère : avant les tâches 6 et 7, ce test trouve **exactement quatorze**
coupables (mesuré le 2026-09-11). Si tu en vois d'autres, quelqu'un a ajouté
une teinte pendant le chantier.

- [ ] **Step 3 : prouver qu'il mord**

Réintroduire temporairement `shadow-[0_4px_12px_rgba(33,30,26,.15)]` dans `src/features/vins/ui/CaveMap.tsx`, lancer.
Expected : FAIL, avec `features/vins/ui/CaveMap.tsx` dans la liste. Remettre, PASS. Recopier les deux sorties.

- [ ] **Step 4 : suite complète**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
npx supabase db reset && npm run test:e2e
```

Expected : tout vert. Les e2e sont le seul endroit où un arrondi qui rogne un contenu se verrait.

- [ ] **Step 5 : le coup d'œil du PO**

Le spec l'exige et aucun test ne le remplace : les rôles **dérivés** —
`--danger`, l'or, le violet, les dégradés, et le thème clair entier — n'ont
pas de source dans la maquette. Lancer `npm run dev`, ouvrir l'accueil, une
fiche de restaurant, la carte et les réglages, dans les deux thèmes, et
demander au PO de valider avant d'attaquer le lot suivant. Signaler
explicitement que la carte reste claire : c'est voulu, pas un défaut.

- [ ] **Step 6 : commit**

```bash
git add src/test/teintes-litterales.test.ts
git commit -m "test(design): une teinte en dur hors de la table fait désormais échouer la suite"
```

---

## Ce que ce plan ne fait pas

- Aucun composant reconstruit (lots 1 à 6 de la refonte).
- Les vingt-sept `text-white` sur `bg-accent` restent — `--on-fill` est créé, pas employé.
- Le favori reste doré, le marqueur « testé » reste gris.
- Les tuiles OpenStreetMap restent claires : la carte sera une fenêtre lumineuse dans une coque nuit, et le choix des tuiles appartient au lot 4.
- `TagsAdmin.tsx` garde son `#5B7F5B` : c'est une couleur d'utilisateur, pas un jeton.
