# Refonte v3 — lot 6A : les primitives, et la fin du blanc sur aplat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rhabiller les cinq primitives que le canevas v3 redéfinit, et supprimer
le texte blanc posé sur un aplat de jeton — illisible depuis que le lot 0 a fait
du sombre le défaut.

**Architecture :** aucune API nouvelle. On corrige des composants qui existent
(`Button`, `Skeleton`, `SectionLabel`, `Tile` → `StatTile`, `Badge` →
`CountBadge`), on ajoute deux rôles à la table des jetons, et on ferme deux trous
de garde-fou. Les tâches 1 et 2 forment **un correctif livrable seul** : elles
réparent une régression en production sans rien changer d'autre.

**Tech Stack :** Next.js 16, React 19, Tailwind v4 (jetons en variables CSS
exposées via `@theme`), Vitest, Storybook, Playwright.

**Spec :** `docs/superpowers/specs/2026-09-11-refonte-v3-lot6-composants-design.md`

## Global Constraints

- **Aucune teinte littérale** hors de la liste close de
  `src/test/teintes-litterales.test.ts`. Toute couleur passe par un rôle.
- **Aucun rayon littéral** dans une classe Tailwind (`rounded-[Npx]` interdit).
- Les valeurs viennent du canevas `refonte v3 - ecrans.dc.html`, bloc
  `data-screen-label="Composants"`. Ne rien inventer : ce qui n'y est pas est
  dérivé, et doit être signalé comme tel.
- Tout nouveau rôle de jeton doit être défini dans **les deux thèmes** et exposé
  dans `@theme`, sinon `src/app/theme.test.ts` échoue.
- Tout garde-fou ajouté doit être **éprouvé par cassure délibérée** : le voir
  rougir, puis verdir. Un test qui n'a jamais échoué ne prouve rien.
- Français dans les commentaires, les noms de test et les messages de commit.

## Contexte : pourquoi la tâche 2 est urgente

Le lot 0 a inversé le thème par défaut. `text-white` ne change pas avec le
thème ; les fonds en jetons, si. Résultat mesuré :

| Paire | Sombre (défaut actuel) | Clair (défaut d'avant) | Avec `--on-fill` |
|---|---|---|---|
| blanc sur `--ink` | **1,12:1** | 18,75:1 | 16,70:1 |
| blanc sur `--danger` | **2,84:1** | 6,54:1 | 6,61:1 |
| blanc sur `--accent` | **2,48:1** | 4,78:1 | 7,54:1 |

Les pastilles de sous-onglet et de filtre de l'onglet Activités affichent donc
aujourd'hui du texte blanc sur une pastille quasi blanche. Aucun test ne l'a vu :
`theme.test.ts` éprouve la table des jetons, jamais l'usage qu'on en fait.

## Structure des fichiers

- `src/test/fichiersSources.ts` — **créer**. L'énumération des fichiers de `src`,
  aujourd'hui enfermée dans `teintes-litterales.test.ts`. Deux garde-fous en ont
  besoin ; une seconde copie divergerait.
- `src/test/texte-sur-aplat.test.ts` — **créer**. Interdit `text-white`.
- `src/test/teintes-litterales.test.ts` — modifier (motif `{3,6}`, emploi du
  module d'énumération).
- `src/app/globals.css` — modifier (deux rôles).
- `src/app/theme.test.ts` — modifier (trois seuils).
- `src/features/shared/ui/{Button,Skeleton,SectionLabel,Tile,Badge}.tsx` et
  leurs `.stories.tsx` — modifier.
- `src/features/shared/ui/CountBadge.tsx` + `.stories.tsx` — créer.
- 27 fichiers consommateurs — modifier (listés dans leurs tâches).

---

### Task 1 : le garde-fou qui aurait dû l'attraper

**Files:**
- Create: `src/test/fichiersSources.ts`
- Create: `src/test/texte-sur-aplat.test.ts`
- Modify: `src/test/teintes-litterales.test.ts`

**Interfaces:**
- Produces: `fichiersSources(): string[]` — chemins relatifs à `src/`, fichiers
  `.ts`/`.tsx`/`.css`, hors `*.test.*` et `*.stories.*`. Les tâches 7 et
  suivantes s'en servent.

- [ ] **Step 1 : extraire l'énumération dans un module**

Créer `src/test/fichiersSources.ts` :

```ts
import { readdirSync } from "node:fs";
import path from "node:path";

export const SRC = path.resolve(__dirname, "..");

/**
 * Les fichiers de `src` qu'un garde-fou doit balayer : le code qu'on écrit,
 * pas ce qui l'éprouve. Vit dans son propre module parce que deux garde-fous
 * s'en servent — une seconde copie finirait par balayer un ensemble différent
 * du premier, et le trou ne se verrait nulle part.
 */
export function fichiersSources(): string[] {
  return readdirSync(SRC, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(ts|tsx|css)$/.test(e.name))
    .map((e) => path.relative(SRC, path.join(e.parentPath, e.name)))
    .filter((p) => !/\.(test|stories)\.tsx?$/.test(p));
}
```

- [ ] **Step 2 : faire consommer ce module au garde-fou des teintes**

Dans `src/test/teintes-litterales.test.ts`, remplacer la constante `SRC` et la
fonction `fichiers` locales par l'import, sans toucher aux deux `it` :

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources } from "./fichiersSources";
```

Supprimer les lignes `const SRC = path.resolve(__dirname, "..");` et tout le
corps de `function fichiers(dir: string)`.

Puis remplacer les **deux** appels `fichiers(SRC)` par `fichiersSources()` :
la fonction extraite ne prend aucun argument, et `fichiers(SRC)` ferait échouer
`tsc` sur « Expected 0 arguments, but got 1 ».

- [ ] **Step 3 : vérifier que le garde-fou des teintes passe toujours**

Run : `npx vitest run src/test/teintes-litterales.test.ts`
Expected : PASS, 2 tests. Si le compte de fichiers balayés a changé,
l'extraction n'est pas fidèle — comparer avant de continuer.

- [ ] **Step 4 : écrire le garde-fou, avec sa dette déclarée**

Créer `src/test/texte-sur-aplat.test.ts`. Deux listes, pas une : ce qui est
**légitime** pour toujours, et ce que **ce lot n'a pas encore migré**. Un test
rouge qui resterait rouge pendant six tâches serait committé rouge au premier
`git add -A` ; une dette déclarée garde la branche verte à chaque commit sans
rien cacher.

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources } from "./fichiersSources";

// `--on-fill` est le rôle du texte posé sur un aplat, et il s'inverse avec le
// thème. `text-white` ne s'inverse pas : c'est la façon de contourner le rôle
// sans qu'aucun test ne bronche. C'est ainsi que le basculement du défaut en
// sombre (lot 0) a fait passer trois familles d'aplats de conformes à
// illisibles d'un coup — blanc sur --ink donne 1,12:1.
//
// Liste CLOSE et DÉFINITIVE. Chaque entrée porte la MESURE qui la justifie.
const AUTORISES: Record<string, string> = {
  "features/shared/ui/Avatar.tsx":
    "le fond est une teinte de la palette d'avatars : le blanc y tient 4,47 à 5,88:1, --on-fill n'y ferait que 3,19 à 4,19:1",
  "features/activites/ui/ListeActivites.tsx":
    "pastille sur la couleur du membre (même palette que les avatars)",
  "features/activites/ui/CarteActivites.tsx":
    "pastille sur la couleur du membre (même palette que les avatars)",
  "features/activites/ui/VueSemaine.tsx":
    "pastille sur la couleur du membre (même palette que les avatars)",
  "features/voyages/ui/VoyageDetail.tsx":
    "surimpression sur la photo de couverture, sous un dégradé noir",
  "features/vins/ui/VinFiche.tsx":
    "surimpression sur l'aplat de couleur du vin, sous un dégradé noir",
  "features/restos/ui/FicheResto.tsx":
    "surimpression sur la photo de l'établissement, sous un dégradé noir",
  "features/places/ui/PlaceCard.tsx":
    "le fond est la couleur de tag choisie par l'utilisateur : aucun rôle ne peut la prévoir",
};

// TEMPORAIRE. Ce que 6A n'a pas encore migré, et la tâche qui l'emporte.
// Rempli au step 5 depuis la sortie réelle du test, pas de mémoire.
const DETTE: Record<string, string> = {};

describe("le texte posé sur un aplat", () => {
  it("n'emploie `text-white` que là où aucun rôle ne convient", () => {
    const connus = { ...AUTORISES, ...DETTE };
    const coupables = fichiersSources()
      .filter((f) => !(f in connus))
      .filter((f) => /\btext-white\b/.test(readFileSync(path.join(SRC, f), "utf8")))
      .sort();
    expect(coupables).toEqual([]);
  });

  // Une liste de dette qu'on oublie de vider redevient une liste d'exceptions,
  // et la dette est alors payée sans que personne ne le sache. Ce test force à
  // retirer chaque entrée au moment où sa tâche la règle.
  it("ne garde aucune dette déjà payée", () => {
    const payees = Object.keys(DETTE)
      .filter((f) => !/\btext-white\b/.test(readFileSync(path.join(SRC, f), "utf8")))
      .sort();
    expect(payees).toEqual([]);
  });
});
```

- [ ] **Step 5 : lancer, et remplir `DETTE` depuis la sortie réelle**

Run : `npx vitest run src/test/texte-sur-aplat.test.ts`
Expected : **FAIL**, avec une liste d'environ 25 fichiers.

Recopier cette liste — c'est le plan de travail des tâches 2, 5 et 6 — puis
remplir `DETTE` avec ses entrées, chacune portant sa tâche :

```ts
const DETTE: Record<string, string> = {
  "features/activites/ui/SousOnglets.tsx": "tâche 2",
  "features/shared/ui/Fab.tsx": "tâche 5",
  "features/restos/ui/VisiteCta.tsx": "tâche 6",
  // … une ligne par fichier de la sortie, avec la tâche qui l'emporte :
  //   tâche 2 : SousOnglets, FiltresActivites, DonneesSection
  //   tâche 5 : Fab, NavItem  (Avatar est dans AUTORISES, pas ici)
  //   tâche 6 : les seize boutons faits main et les badges
};
```

Ne rien inventer : si la sortie contient un fichier qu'aucune de ces trois
tâches ne cite, c'est qu'un `text-white` a été ajouté pendant le chantier. Le
signaler plutôt que de l'absorber.

- [ ] **Step 6 : vérifier que tout est vert, puis committer**

Run : `npx vitest run src/test/texte-sur-aplat.test.ts`
Expected : PASS, 2 tests.

```bash
npm run lint && npx tsc --noEmit && npm test
git add src/test/fichiersSources.ts src/test/texte-sur-aplat.test.ts src/test/teintes-litterales.test.ts
git commit -m "test(design): le blanc sur aplat devient une dette déclarée, et non plus un angle mort"
```

---

### Task 2 : les cinq aplats illisibles (correctif livrable seul)

**Files:**
- Modify: `src/features/activites/ui/SousOnglets.tsx:29`
- Modify: `src/features/activites/ui/FiltresActivites.tsx:74,98`
- Modify: `src/features/compte/ui/DonneesSection.tsx:94,116`

**Interfaces:**
- Consumes: le garde-fou rouge de la tâche 1.
- Produces: rien.

C'est la régression. `bg-ink text-white` donne **1,12:1** en thème sombre — du
blanc sur du blanc. `bg-danger text-white` donne 2,84:1.

- [ ] **Step 1 : remplacer les trois `bg-ink text-white`**

```bash
perl -pi -e 's/bg-ink text-white/bg-ink text-on-fill/g' \
  src/features/activites/ui/SousOnglets.tsx \
  src/features/activites/ui/FiltresActivites.tsx
```

Vérifier que `FiltresActivites.tsx:74` est bien touché : sa classe s'écrit
`border-ink bg-ink px-…` avec `text-white` plus loin dans la même chaîne. Si le
`perl` ne l'a pas prise, la corriger à la main — `text-white` → `text-on-fill`.

- [ ] **Step 2 : remplacer les deux `bg-danger text-white`**

```bash
perl -pi -e 's/text-white/text-on-fill/g' src/features/compte/ui/DonneesSection.tsx
```

`--on-fill` sur `--danger` donne 6,61:1 en sombre, 6,54:1 en clair.

- [ ] **Step 3 : vérifier qu'il ne reste aucun de ces cinq**

```bash
grep -rn 'bg-ink text-white\|bg-danger[^-]*text-white' src --include='*.tsx'
```

Expected : aucune sortie.

- [ ] **Step 4 : lancer les tests des écrans touchés**

Run : `npx vitest run src/features/activites src/features/compte`
Expected : PASS. Ces tests ne regardent pas la couleur — s'ils échouent, c'est
qu'une classe a été cassée, pas que le contraste a changé.

- [ ] **Step 5 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "fix(design): du texte blanc sur une pastille blanche depuis que le sombre est le défaut"
```

**Retirer de `DETTE`** les trois entrées que cette tâche vient de payer
(`SousOnglets`, `FiltresActivites`, `DonneesSection`) : le second test de la
tâche 1 échoue sinon, et c'est exactement son rôle.

---

### Task 3 : les deux rôles que le canevas réclame

**Files:**
- Modify: `src/app/globals.css:11-23` (bloc sombre), `:33-45` (bloc clair), `:48+` (`@theme`)
- Modify: `src/app/theme.test.ts` (constante `SEUILS`)

**Interfaces:**
- Produces: `--accent-active`, `--line-strong`, et leurs classes Tailwind
  `bg-accent-active` / `border-line-strong`. La tâche 4 s'en sert.

- [ ] **Step 1 : ajouter les seuils AVANT les rôles**

Dans `src/app/theme.test.ts`, ajouter trois lignes à `SEUILS` :

```ts
  ["on-fill", "accent-active", 4.5],
  ["on-fill", "kpi-amber", 4.5],
  ["on-fill", "kpi-green", 4.5],
```

- [ ] **Step 2 : lancer et vérifier l'échec**

Run : `npx vitest run src/app/theme.test.ts`
Expected : **FAIL** sur les deux thèmes, message `--accent-active absent`.
Les deux lignes `kpi-*` doivent, elles, PASSER — les rôles existent déjà.

- [ ] **Step 3 : ajouter les deux rôles au bloc sombre**

Dans `:root, [data-theme="dark"]`, après la ligne `--accent-50: …; --accent-600: …;` :

```css
  /* Le bleu de l'état pressé, relevé au canevas. Sans ce rôle, le pressé d'un
     bouton ne peut s'écrire qu'en dur — ce que le garde-fou des teintes
     interdit — ou disparaître. */
  --accent-active: #4D8DFF;
```

Et après la ligne `--line: …; --line-soft: …;` :

```css
  /* La bordure des états survolés : le canevas la monte à 16 % là où --line
     est à 8 %. En thème clair, sans elle, le survol ne se distingue plus du
     repos. */
  --line-strong: rgba(255,255,255,0.16);
```

- [ ] **Step 4 : ajouter les contreparties claires**

Dans `[data-theme="light"]`, aux mêmes endroits :

```css
  --accent-active: #17479A;
```
```css
  --line-strong: #C3CDDC;
```

`--on-fill` clair (`#FFFFFF`) sur `#17479A` donne **8,73:1**, et reste distinct
de `--accent-hover` clair (`#1F57B4`, 6,82:1) : le pressé se voit.

`#C3CDDC` est **dérivé, pas mesuré** — aucun seuil WCAG ne contraint une
bordure. À faire regarder par le PO avec les autres rôles dérivés.

- [ ] **Step 5 : exposer les deux à `@theme`**

Dans le bloc `@theme`, à côté de leurs voisins :

```css
  --color-accent-active: var(--accent-active);
  --color-line-strong: var(--line-strong);
```

Sans ces deux lignes, le test « expose à @theme tout rôle de couleur des blocs »
échoue — et les classes `bg-accent-active` / `border-line-strong` n'existeraient
pas.

- [ ] **Step 6 : vérifier**

Run : `npx vitest run src/app/theme.test.ts`
Expected : PASS, tous les tests — dont la parité des rôles entre thèmes et les
trois nouveaux seuils.

- [ ] **Step 7 : prouver que les seuils mordent**

Remplacer temporairement `--accent-active: #4D8DFF` par `#B9D4FF` (un bleu trop
clair), lancer.
Expected : FAIL, `on-fill sur accent-active tient 4.5:1`. Remettre, PASS.
Recopier les deux sorties.

- [ ] **Step 8 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): deux rôles que le canevas emploie et que la table n'avait pas"
```

---

### Task 4 : le bouton primaire, et ses six états

**Files:**
- Modify: `src/features/shared/ui/Button.tsx`
- Modify: `src/features/shared/ui/Button.stories.tsx`

**Interfaces:**
- Consumes: `--accent-active` et `--line-strong` (tâche 3).
- Produces: `Button` avec les mêmes props qu'aujourd'hui
  (`variant?: "primary" | "ghost" | "subtle"`, `pending?: boolean`, plus tous
  les attributs d'un `<button>`). Les tâches 6 et suivantes y branchent des
  appelants ; **l'API ne change pas**, seule l'apparence change.

Le canevas donne six états : défaut, survol, focus visible, pressé, désactivé,
chargement. Le composant en porte trois.

- [ ] **Step 1 : réécrire le composant**

Remplacer tout `src/features/shared/ui/Button.tsx` par :

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

// `text-on-fill` et non `text-white` : le blanc ne s'inverse pas avec le thème,
// et sur l'accent sombre il tombe à 2,48:1. --on-fill y tient 7,54:1.
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-on-fill hover:bg-accent-hover active:bg-accent-active disabled:bg-badge disabled:text-faint",
  ghost:
    "border border-line bg-transparent text-ink hover:border-line-strong hover:bg-surface-hover disabled:text-faint",
  subtle:
    "bg-surface text-muted hover:bg-surface-hover disabled:text-faint",
};

export function Button({
  variant = "primary",
  pending,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pending?: boolean }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-card px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[.97] disabled:pointer-events-none ${VARIANT[variant]} ${className}`}
      disabled={pending || props.disabled}
      aria-busy={pending || undefined}
      {...props}
    >
      {/* Le canevas montre un disque qui tourne, pas un bouton simplement
          inerte : sans lui, une action lente est indistinguable d'un clic
          perdu. `border-current` le teint comme le texte, donc il suit la
          variante sans connaître sa couleur. */}
      {pending && (
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current/35 border-t-current"
        />
      )}
      {children}
    </button>
  );
}
```

Deux écarts assumés, à signaler dans le rapport :

- Le rayon passe de `rounded-control` (10 px) à `rounded-card` (12 px), qui est
  la valeur du canevas. `--radius-control` n'a plus de source dans le canevas
  v3 ; les contrôles segmentés du lot 6B y reviendront.
- `disabled:opacity-60` disparaît. Le canevas donne un aplat éteint
  (`--badge` / `--faint`) ; l'opacité délavait aussi le texte, qui devenait
  moins lisible que le fond ne le justifiait.

- [ ] **Step 2 : couvrir les six états dans les stories**

Dans `src/features/shared/ui/Button.stories.tsx`, ajouter une story qui les
montre tous — c'est le seul endroit où le pressé et le chargement se regardent :

```tsx
export const TousLesEtats = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <Button>Chercher</Button>
      <Button disabled>Chercher</Button>
      <Button pending>Chargement</Button>
      <Button variant="ghost">Chercher</Button>
      <Button variant="subtle">Chercher</Button>
    </div>
  ),
};
```

Le survol, le focus et le pressé ne se scriptent pas dans une story : ils se
regardent à la souris et au clavier sur cette planche.

- [ ] **Step 3 : lancer les tests qui touchent au bouton**

Run : `npm test`
Expected : PASS. Un test qui cherchait `opacity-60` ou `rounded-control` sur un
bouton échouerait ici — le corriger vers la nouvelle classe, ne pas remettre
l'ancienne.

- [ ] **Step 4 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): le bouton primaire cesse d'écrire blanc sur son accent"
```

---

### Task 5 : Fab, NavItem, Avatar

**Files:**
- Modify: `src/features/shared/ui/Fab.tsx:5`
- Modify: `src/features/shared/ui/NavItem.tsx:36`
- Modify: `src/features/shared/ui/Avatar.tsx:12`

**Interfaces:**
- Consumes: rien.
- Produces: rien — aucune signature ne change.

Trois primitives portent leur propre copie du blanc sur accent. `Avatar` est le
cas intéressant : il faut le traiter **différemment des deux autres**.

- [ ] **Step 1 : `Fab` — l'aplat est toujours l'accent**

Dans `FAB_CLASS`, remplacer `text-white` par `text-on-fill`.

- [ ] **Step 2 : `NavItem` — la pastille de compteur**

Ligne 36, remplacer `text-white` par `text-on-fill`.

- [ ] **Step 3 : `Avatar` — NE PAS remplacer le blanc**

`Avatar` écrit son texte tantôt sur l'accent (`bg-accent`, quand aucune couleur
n'est fournie), tantôt sur une teinte de la palette d'avatars. Mesuré :

| Fond | blanc | `--on-fill` |
|---|---|---|
| `#4A6BA3` | 5,35:1 | 3,50:1 |
| `#5C7A99` | 4,47:1 | 4,19:1 |
| `#6E5C8C` | 5,88:1 | 3,19:1 |
| `#4A7A6B` | 4,90:1 | 3,83:1 |
| `#8C6A5C` | 4,85:1 | 3,87:1 |
| `--accent` sombre | 2,48:1 | 7,54:1 |

Le blanc est **meilleur** sur la palette, et `--on-fill` y échoue partout. Le
remplacer en bloc dégraderait cinq cas pour en réparer un. Séparer :

```tsx
export function Avatar({ name, size = "md", color }: { name: string; size?: "sm" | "md" | "lg" | "xl"; color?: string }) {
  return (
    <span
      // Deux textes, parce qu'il y a deux fonds. Sur une teinte de la palette
      // d'avatars, le blanc tient 4,47 à 5,88:1 et --on-fill n'y ferait que
      // 3,19 à 4,19:1 ; sur le repli en accent, c'est exactement l'inverse
      // (2,48:1 contre 7,54:1). Un seul texte pour les deux fonds dégraderait
      // forcément l'un des deux.
      className={`inline-grid place-items-center rounded-full font-semibold ${DIM[size]} ${color ? "text-white" : "bg-accent text-on-fill"}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
```

`Avatar.tsx` reste donc dans la liste `AUTORISES` du garde-fou — avec la mesure
qui le justifie, déjà écrite tâche 1.

- [ ] **Step 4 : signaler le cas limite, ne pas le corriger**

`#5C7A99` donne 4,47:1 avec le blanc : **0,03 sous le seuil** de 4,5:1 pour du
texte normal, et les initiales en taille `sm` (12 px) ne sont pas du « grand
texte » au sens WCAG. C'est la palette d'avatars du lot 0 qui est en cause, pas
ce composant. Le porter au rapport pour décision PO ; **ne pas** retoucher la
palette ici — elle est en base (migration `00066`) et la changer demande un
backfill.

- [ ] **Step 5 : retirer la dette payée, puis vérifier et committer**

Retirer de `DETTE` (dans `src/test/texte-sur-aplat.test.ts`) les entrées
`Fab.tsx` et `NavItem.tsx`. **Ne pas** y toucher pour `Avatar.tsx` : il est dans
`AUTORISES`, définitivement, avec sa mesure.

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "fix(design): trois primitives portaient leur propre copie du blanc sur accent"
```

---

### Task 6 : les seize boutons faits main

**Files:**
- Modify: `src/app/[locale]/(auth)/inscription/page.tsx:31`
- Modify: `src/features/auth/ui/ConnexionPanel.tsx:56`
- Modify: `src/features/auth/ui/BoutonPasskey.tsx:63`
- Modify: `src/features/auth/ui/AuthPanel.tsx:49`
- Modify: `src/features/invitations/ui/CreerCompteTunnel.tsx:61,88,123`
- Modify: `src/features/restos/ui/TagsAdmin.tsx:64`
- Modify: `src/features/restos/ui/VisiteCta.tsx:22`
- Modify: `src/features/vins/ui/BuyButton.tsx:18`
- Modify: `src/features/voyages/ui/ModeVoyageBlock.tsx:101`
- Modify: `src/features/voyages/ui/PlanningFrise.tsx:133`
- Modify: `src/features/voyages/ui/VoyagesList.tsx:95`
- Modify: `src/features/voyages/ui/VoyageDetail.tsx:100`
- Modify: `src/features/places/ui/CategoryTabs.tsx:145,366`
- Modify: `src/app/[locale]/(app)/abonnement/page.tsx:70`

**Interfaces:**
- Consumes: `Button` (tâche 4).
- Produces: rien.

Seize aplats d'accent recopiés à la main. Corriger leur `text-white` suffirait
au contraste — mais laisserait seize copies libres de rediverger au prochain
changement de bouton.

- [ ] **Step 1 : trier avant de migrer**

Les seize ne sont pas tous des boutons. Les classer en trois familles :

- **de vrais boutons ou liens d'action** (`inscription/page.tsx`,
  `ConnexionPanel`, `BoutonPasskey`, `AuthPanel`, `CreerCompteTunnel` ×3,
  `TagsAdmin`, `VisiteCta`, `ModeVoyageBlock`, `CategoryTabs:366`) → remplacer
  par `<Button>`. Ceux qui sont des `<Link>` ou des `<LienExterne>` gardent leur
  élément et reçoivent `text-on-fill` : `Button` rend un `<button>`, et un lien
  déguisé en bouton casse la navigation au clavier.
- **des segments de commutateur** (`CategoryTabs:145`,
  `PlanningFrise:133`) → `text-on-fill` seulement. Ce sont des contrôles
  segmentés : ils appartiennent au lot **6B**, qui leur donnera `SubTabPills` et
  `ViewSwitcher`. Les forcer dans `Button` maintenant les ferait migrer deux
  fois.
- **des badges** (`VoyagesList:95`, `VoyageDetail:100`, `abonnement:70`) →
  `text-on-fill` seulement. Ils deviendront des `CountBadge` ou des chips au lot
  6B.

Recopier ce classement dans le rapport de tâche : il commande ce que 6B trouvera.

- [ ] **Step 2 : migrer la première famille vers `Button`**

Pour chaque fichier de la famille « vrais boutons », remplacer la chaîne de
classes recopiée par le composant. Exemple, `src/features/restos/ui/VisiteCta.tsx:22` :

```tsx
// avant
<button className="flex w-full items-center justify-center gap-2 rounded-control bg-accent py-3 text-[13.5px] font-semibold text-white …" …>

// après
<Button className="w-full py-3 text-[13.5px]" …>
```

Ne garder dans `className` que ce qui est **propre à l'appelant** (largeur,
taille de texte particulière). Tout ce que `Button` porte déjà — fond, texte,
rayon, focus, transition — doit disparaître de l'appel, sinon la duplication
reste, simplement déplacée.

Ajouter l'import : `import { Button } from "@/features/shared/ui/Button";`

- [ ] **Step 3 : corriger les deux autres familles**

```bash
perl -pi -e 's/\btext-white\b/text-on-fill/g' \
  src/features/places/ui/CategoryTabs.tsx \
  src/features/voyages/ui/PlanningFrise.tsx \
  src/features/voyages/ui/VoyagesList.tsx \
  'src/app/[locale]/(app)/abonnement/page.tsx'
```

**`VoyageDetail.tsx` est volontairement absent de cette commande.** Son
`text-white` de la ligne 99 porte sur le conteneur posé **au-dessus de la photo
de couverture** : il est légitime, et un remplacement aveugle le casserait. Ce
qui doit changer, c'est la pastille de la ligne 100, qui hérite ce blanc tout en
posant son propre aplat d'accent. Lui donner sa propre couleur de texte :

```tsx
// avant
<span className="rounded-full bg-accent/95 px-2.5 py-1 text-[10px] font-semibold">

// après
<span className="rounded-full bg-accent/95 px-2.5 py-1 text-[10px] font-semibold text-on-fill">
```

Le fichier restant dans `AUTORISES`, aucun test ne verra cette pastille : c'est
le seul endroit de ce lot où la relecture humaine est la seule garantie. Le dire
dans le rapport de tâche.

- [ ] **Step 4 : vider `DETTE`, et voir le garde-fou tenir seul**

Retirer de `DETTE` toutes les entrées restantes : cette tâche était la dernière.
La constante doit finir vide — `const DETTE: Record<string, string> = {};` — et
le commentaire qui la coiffe le dire.

Run : `npx vitest run src/test/texte-sur-aplat.test.ts`
Expected : **PASS**, 2 tests, sans aucune dette.

S'il reste des coupables, les traiter — ne **pas** les verser dans `AUTORISES`
sans une mesure qui le justifie. Une exception sans chiffre est une opinion.

- [ ] **Step 5 : prouver qu'il mord**

Réintroduire `text-white` dans `src/features/shared/ui/Button.tsx`, lancer.
Expected : FAIL, avec `features/shared/ui/Button.tsx` dans la liste. Remettre,
PASS. Recopier les deux sorties.

- [ ] **Step 6 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
git add -A
git commit -m "fix(design): seize boutons recopiés à la main rejoignent le composant"
```

---

### Task 7 : le garde-fou des teintes voit enfin les hexadécimaux courts

**Files:**
- Modify: `src/test/teintes-litterales.test.ts` (constante `TEINTE`)
- Modify: `src/features/places/ui/CategoryMap.tsx:50`
- Modify: `src/features/vins/ui/CaveMap.tsx:22-23`

**Interfaces:**
- Consumes: `fichiersSources()` (tâche 1).
- Produces: rien.

Le motif exige six chiffres hexadécimaux. `#fff` en a trois : il passe. Quatre
occurrences dans `src/`, toutes dans des pastilles de cluster, dont deux qui
refont le 2,48:1 (`color:#fff` sur `background:var(--accent)`).

- [ ] **Step 1 : élargir le motif**

Dans `src/test/teintes-litterales.test.ts` :

```ts
// `{3,6}` et non `{6}` : une notation courte est une teinte comme une autre, et
// quatre `#fff` ont vécu dans des pastilles de carte sans que ce test les voie.
// Deux d'entre eux posaient du blanc sur l'accent — 2,48:1.
const TEINTE = /#[0-9A-Fa-f]{3,6}(?![0-9A-Fa-f])|rgba?\(\s*\d/;
```

- [ ] **Step 2 : lancer et RECOPIER les coupables**

Run : `npx vitest run src/test/teintes-litterales.test.ts`
Expected : **FAIL**, avec `features/places/ui/CategoryMap.tsx` et
`features/vins/ui/CaveMap.tsx`.

Si d'autres fichiers apparaissent, les traiter aussi : le motif élargi peut
révéler des teintes courtes que personne n'avait comptées.

- [ ] **Step 3 : retourner la pastille de cluster**

Le canevas dessine le cluster à l'inverse de ce que fait le code : cercle de
38 px, fond `--surface`, bordure 2 px en accent, chiffre en `--ink`. Le code
pose un aplat d'accent avec texte et bordure blancs.

Dans `src/features/places/ui/CategoryMap.tsx`, fonction `pastille`, remplacer
`background:var(--accent);color:#fff;border:2px solid #fff;` par :

```
background:var(--color-surface);color:var(--color-ink);border:2px solid var(--accent);
```

Appliquer le même remplacement dans `src/features/vins/ui/CaveMap.tsx:22-23`.

- [ ] **Step 4 : vérifier que le garde-fou verdit**

Run : `npx vitest run src/test/teintes-litterales.test.ts`
Expected : PASS, 2 tests.

- [ ] **Step 5 : prouver que le motif élargi mord**

Réintroduire `color:#fff` dans `CategoryMap.tsx`, lancer.
Expected : FAIL avec ce fichier. Remettre, PASS. Recopier les deux sorties.
C'est la seule preuve que `{3,6}` sert à quelque chose.

- [ ] **Step 6 : vérifier la carte dans un navigateur**

Run : `npm run dev`, ouvrir l'onglet Restaurants, passer en vue carte, dézoomer
jusqu'à voir des pastilles de groupe.

Expected : des cercles sombres cerclés de bleu, chiffre clair lisible. Aucun
test ne regarde le rendu d'un `divIcon` Leaflet — c'est le seul endroit où une
pastille devenue invisible se verrait.

- [ ] **Step 7 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "fix(design): quatre #fff vivaient sous le seuil de détection du garde-fou"
```

---

### Task 8 : le squelette

**Files:**
- Modify: `src/features/shared/ui/Skeleton.tsx`
- Modify: `src/features/activites/ui/ListeActivites.tsx` et l'autre porteur d'`animate-pulse`

**Interfaces:**
- Produces: `Skeleton({ className })` — signature inchangée.

Le canevas donne `--badge` comme fond, un rayon de 12 px et une pulsation
d'opacité de 1,5 s. Le composant pose `bg-line/60` et `rounded-control`.

- [ ] **Step 1 : retendre le composant**

```tsx
// Le canevas pulse l'OPACITÉ d'un aplat --badge, là où `animate-pulse` de
// Tailwind fait la même chose : inutile d'écrire une animation à la main.
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-card bg-badge ${className}`} aria-hidden="true" />;
}
```

- [ ] **Step 2 : trouver les squelettes faits main**

```bash
grep -rn 'animate-pulse' src --include='*.tsx' | grep -v 'shared/ui/Skeleton'
```

Expected : deux lignes. Les remplacer par `<Skeleton className="…" />` en
gardant leurs dimensions dans `className`.

- [ ] **Step 3 : vérifier qu'il n'en reste pas**

```bash
grep -rn 'animate-pulse' src --include='*.tsx' | grep -v 'shared/ui/Skeleton'
```

Expected : aucune sortie.

- [ ] **Step 4 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): le squelette prend l'aplat du canevas, et les deux copies rentrent"
```

---

### Task 9 : l'étiquette de section, et ses deux variantes

**Files:**
- Modify: `src/features/shared/ui/SectionLabel.tsx`
- Modify: `src/features/shared/ui/SectionLabel.stories.tsx`

**Interfaces:**
- Produces: `SectionLabel({ icon?, badge?, ton?, children })` où
  `ton?: "accent" | "neutre"` (défaut `"neutre"`) et `badge?: ReactNode`.
  **Les treize appelants actuels ne passent ni `badge` ni `ton`** : les deux
  props sont facultatives et le rendu sans elles reste celui d'aujourd'hui, au
  filet près.

Le canevas donne deux variantes, et la distinction n'est pas décorative : elle
dit ce qui est à l'utilisateur (« Mes favoris », en accent) et ce qui vient
d'ailleurs (« Ailleurs · Google Places », en neutre).

- [ ] **Step 1 : réécrire le composant**

```tsx
import type { ReactNode } from "react";

type Ton = "accent" | "neutre";

const TON: Record<Ton, { texte: string; pastille: string; filet: string }> = {
  // « Mes favoris » : ce qui appartient à l'utilisateur.
  accent: {
    texte: "text-accent",
    pastille: "border border-accent/30 bg-accent-50 text-accent",
    filet: "bg-accent/20",
  },
  // « Ailleurs · Google Places » : ce qui vient d'un tiers.
  neutre: {
    texte: "text-faint",
    pastille: "border border-line bg-badge text-muted",
    filet: "bg-line",
  },
};

export function SectionLabel({
  icon, badge, ton = "neutre", children,
}: { icon?: ReactNode; badge?: ReactNode; ton?: Ton; children: ReactNode }) {
  const t = TON[ton];
  return (
    <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em]">
      {icon}
      <span className={t.texte}>{children}</span>
      {badge != null && (
        <span className={`rounded-pill px-2 py-0.5 text-[10px] ${t.pastille}`}>{badge}</span>
      )}
      {/* Le filet occupe la largeur restante : c'est lui qui fait de l'étiquette
          une séparation, et non un simple titre. */}
      <span aria-hidden="true" className={`h-px flex-1 ${t.filet}`} />
    </p>
  );
}
```

- [ ] **Step 2 : montrer les deux variantes dans les stories**

```tsx
export const DeuxTons = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <SectionLabel ton="accent" badge={2}>Mes favoris</SectionLabel>
      <SectionLabel badge="Google Places">Ailleurs</SectionLabel>
    </div>
  ),
};
```

- [ ] **Step 3 : vérifier que les treize appelants n'ont pas bougé**

Run : `npm test`
Expected : PASS. Un test qui cherchait `tracking-[0.14em]` échouerait : la
valeur du canevas est `0.09em`. Corriger le test vers la nouvelle valeur.

- [ ] **Step 4 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): l'étiquette de section distingue ce qui est à soi de ce qui vient d'ailleurs"
```

---

### Task 10 : la tuile de statistique

**Files:**
- Modify: `src/features/shared/ui/Tile.tsx`
- Modify: `src/features/shared/ui/Tile.stories.tsx`

**Interfaces:**
- Produces: `Tile({ tone, label, value })` — signature inchangée,
  `tone: "green" | "blue" | "amber" | "violet"` (de `./helpers`).

Le canevas veut le nombre en **serif** 24 px sur un fond teinté à 10 % bordé à
24 %. Le composant l'affiche en gras sur un `--kpi-*-bg` sans bordure.

- [ ] **Step 1 : donner au ton ses classes de fond et de bordure**

Dans `src/features/shared/ui/helpers.ts`, étendre `toneClasses` :

```ts
export function toneClasses(tone: Tone): { bg: string; text: string; tuile: string } {
  const map: Record<Tone, { bg: string; text: string; tuile: string }> = {
    // `tuile` emploie le modificateur d'opacité de Tailwind sur le jeton de ton :
    // le canevas veut un fond à 10 % et une bordure à 24 %, et aucun jeton ne
    // porte la bordure. Passer par le modificateur évite d'ajouter quatre rôles
    // — et d'écrire un littéral, que le garde-fou refuserait.
    green: { bg: "bg-kpi-green-bg", text: "text-kpi-green", tuile: "bg-kpi-green/10 border-kpi-green/24" },
    blue: { bg: "bg-kpi-blue-bg", text: "text-kpi-blue", tuile: "bg-kpi-blue/10 border-kpi-blue/24" },
    amber: { bg: "bg-kpi-amber-bg", text: "text-kpi-amber", tuile: "bg-kpi-amber/10 border-kpi-amber/24" },
    violet: { bg: "bg-kpi-violet-bg", text: "text-kpi-violet", tuile: "bg-kpi-violet/10 border-kpi-violet/24" },
  };
  return map[tone];
}
```

`bg` et `text` restent : d'autres composants s'en servent.

- [ ] **Step 2 : retendre la tuile**

```tsx
import { toneClasses, type Tone } from "./helpers";

export function Tile({ tone, label, value }: { tone: Tone; label: string; value: string | number }) {
  const c = toneClasses(tone);
  return (
    // Le nombre est en serif : c'est la respiration que le canevas donne aux
    // chiffres, et ce qui distingue une statistique d'un compteur.
    <div className={`rounded-tile border p-3.5 ${c.tuile}`}>
      <div className="font-serif text-2xl leading-none text-ink">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </div>
  );
}
```

- [ ] **Step 3 : lancer**

Run : `npm test`
Expected : PASS. Un test qui cherchait `text-kpi-green` sur le nombre échouerait
— le canevas le veut en `--ink`, la couleur du ton passant au fond et à la
bordure. Corriger le test.

- [ ] **Step 4 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): la tuile de statistique prend le chiffre serif et la bordure teintée"
```

---

### Task 11 : `CountBadge` remplace `Badge`

**Files:**
- Create: `src/features/shared/ui/CountBadge.tsx`
- Create: `src/features/shared/ui/CountBadge.stories.tsx`
- Delete: `src/features/shared/ui/Badge.tsx`, `src/features/shared/ui/Badge.stories.tsx`
- Modify: les cinq consommateurs de `Badge`

**Interfaces:**
- Consumes: rien.
- Produces: `CountBadge({ ton?, className?, children, ...rest })` où
  `ton?: "accent" | "alerte" | "neutre"` (défaut `"neutre"`), plus tous les
  attributs d'un `<span>`.

Le canevas donne trois tons de pastille à compteur. `Badge` n'en a qu'un. Les
faire cohabiter garantirait qu'ils divergent.

- [ ] **Step 1 : trouver les cinq consommateurs**

```bash
grep -rn 'from "@/features/shared/ui/Badge"' src --include='*.tsx'
```

Recopier la liste dans le rapport : c'est le périmètre exact du step 3.

- [ ] **Step 2 : créer le composant**

```tsx
import type { HTMLAttributes } from "react";

type Ton = "accent" | "alerte" | "neutre";

// `text-on-fill` sur les deux aplats : 7,54:1 sur l'accent, 9,36:1 sur l'ambre.
// Le canevas propose un brun `#2A1A08` sur l'ambre ; --on-fill y fait mieux et
// évite un rôle de plus.
const TON: Record<Ton, string> = {
  accent: "bg-accent text-on-fill",
  alerte: "bg-kpi-amber text-on-fill",
  neutre: "border border-line bg-badge text-muted",
};

export function CountBadge({
  ton = "neutre", className = "", children, ...rest
}: HTMLAttributes<HTMLSpanElement> & { ton?: Ton }) {
  return (
    <span
      className={`inline-grid min-w-5 place-items-center rounded-pill px-1.5 py-0.5 text-[11px] font-semibold ${TON[ton]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3 : migrer les cinq consommateurs**

Pour chacun : remplacer l'import et la balise. `Badge` était neutre par défaut,
et `CountBadge` l'est aussi — aucun n'a besoin de `ton` sauf s'il portait déjà
une couleur par `className`, auquel cas lui donner le `ton` correspondant et
retirer la classe.

Attention à `src/features/places/ui/PlaceCard.tsx:52` : il passe un
`style={{ backgroundColor: tag.color }}`, une couleur choisie par
l'utilisateur. Le garder tel quel — il reste dans `AUTORISES`.

- [ ] **Step 4 : supprimer l'ancien composant**

```bash
git rm src/features/shared/ui/Badge.tsx src/features/shared/ui/Badge.stories.tsx
```

- [ ] **Step 5 : vérifier qu'il ne reste aucune référence**

```bash
grep -rn 'ui/Badge' src .design-sync .storybook
```

Expected : aucune sortie. **`.design-sync/entry.tsx` réexporte les treize
primitives** : s'il cite `Badge`, le remplacer par `CountBadge`, sinon le
prochain `/design-sync` échouera.

- [ ] **Step 6 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
git add -A
git commit -m "feat(design): une pastille à compteur à trois tons, au lieu d'une à un seul"
```

---

### Task 12 : la suite complète, et le coup d'œil

**Files:** aucun.

- [ ] **Step 1 : la suite entière**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
npx supabase db reset && npm run test:e2e
```

Expected : tout vert. Le `db reset` avant les e2e n'est pas décoratif : lancer
les e2e sur une base déjà servie fausse le pgTAP du RLS ensuite.

- [ ] **Step 2 : le storybook**

```bash
npx storybook build -c .storybook -o .design-sync/sb-reference
```

Expected : construction réussie. C'est aussi ce dont le prochain `/design-sync`
a besoin.

- [ ] **Step 3 : le coup d'œil du PO**

Aucun test ne remplace celui-ci. Lancer `npm run dev` et regarder, **dans les
deux thèmes** :

- l'onglet Activités — le sous-onglet actif et les filtres choisis, qui étaient
  illisibles ;
- un bouton primaire au repos, au survol, au clavier, et **maintenu enfoncé** ;
- la carte des restaurants dézoomée — les pastilles de groupe retournées ;
- un avatar sans photo, et un avatar de membre coloré ;
- une tuile de statistique et une étiquette de section.

Signaler au PO les deux valeurs **dérivées et non mesurées** de ce lot :
`--line-strong` en thème clair (`#C3CDDC`), et le cas limite `#5C7A99` de la
palette d'avatars (4,47:1, soit 0,03 sous le seuil).

---

## Ce que ce plan ne fait pas

- Il ne construit **aucun** des cinq composants qui n'existent pas — `TagChip`,
  `SearchField`, `SubTabPills`, `ViewSwitcher`, `StatusToggle`,
  `PlaceMapMarker`. Ils appartiennent à 6B et 6C.
- Il ne migre **pas** les 108 pastilles relevées au spec. Il touche seulement
  celles qui portaient du blanc sur un aplat.
- Il ne retouche **pas** la palette d'avatars, même après avoir mesuré son cas
  limite : elle est en base et la changer demande un backfill.
- Il ne déplace **pas** le favori de l'étoile or vers le cœur accent — décision
  PO prise au spec, mais elle vit dans `PlaceCard` et le marqueur de carte,
  donc dans 6C.
- Il n'écrit **pas** le garde-fou que le spec réclame contre un écran qui
  **réécrirait** un composant migré. Il serait vide ici : les cinq composants
  qu'on pourrait réécrire à la main n'existent pas encore. Il appartient à 6B,
  qui les construit et migre leurs 108 copies — c'est là qu'il aura quelque
  chose à interdire.
