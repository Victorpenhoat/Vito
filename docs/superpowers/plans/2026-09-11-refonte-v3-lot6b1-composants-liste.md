# Refonte v3 — lot 6B-1 : les quatre composants de liste, et l'écran de référence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** construire `TagChip`, `SearchField`, `SubTabPills` et `ViewSwitcher`,
les éprouver sur l'écran qui les contient tous les quatre, et déclarer en dette
les 102 pastilles faites main que 6B-2 et 6B-3 rapatrieront.

**Architecture :** quatre composants neufs dans `src/features/shared/ui/`, plus
un garde-fou qui interdit de dessiner une pastille à la main hors de ce dossier.
La migration complète ne tient pas dans un plan relisible : celui-ci livre les
composants et **un seul écran**, `CategoryTabs`, qui les héberge tous les quatre.
Le reste est déclaré en dette et drainé par famille.

**Tech Stack :** Next.js 16, React 19, Tailwind v4 (jetons en variables CSS
exposées via `@theme`), Vitest, Storybook, Playwright.

**Spec :** `docs/superpowers/specs/2026-09-11-refonte-v3-lot6-composants-design.md`

## Global Constraints

- **Aucune teinte littérale** ni **aucun rayon littéral** : `src/test/teintes-litterales.test.ts` les refuse, notations courtes (`#fff`) comprises.
- **Aucun `text-white`** hors de la liste close de `src/test/texte-sur-aplat.test.ts`. `--on-fill` est le rôle du texte sur un aplat.
- Les valeurs viennent du canevas `refonte v3 - ecrans.dc.html`, bloc `data-screen-label="Composants"`, complété par l'écran `M · Fiche adresse`. Ce qui n'y est pas est **dérivé**, et doit être signalé comme tel.
- Tout garde-fou ajouté doit être **éprouvé par cassure délibérée** : le voir rougir, puis verdir. La cassure doit faire échouer **l'assertion visée**, pas une assertion antérieure du même test — sinon la preuve ne prouve rien.
- Pour déclencher un événement dans un test : `fireEvent` de `@testing-library/react`. **Jamais** `@testing-library/user-event` (non déclaré dans `package.json`, il ne se résout que par hoisting depuis storybook), ni `element.click()` natif.
- Toute prop de l'interface publique doit avoir un test qui échoue si elle cesse de fonctionner. Un `data-testid` ou un attribut ARIA doit être éprouvé **sur l'élément interactif**, pas « quelque part dans la sortie ».
- Un composant ne doit **jamais** être migré à moitié : si un site résiste, le laisser en dette plutôt que de tordre le composant.
- Français dans les commentaires, les noms de test et les messages de commit.

## Le tri, mesuré

107 sites dessinent une pastille à la main (`rounded-full` + padding) dans 65
fichiers. Ils ne sont **pas** 107 `TagChip` — c'est l'erreur que ce plan existe
pour empêcher :

| Famille | Sites | Fichiers | Destination |
|---|---|---|---|
| **A** — pastille interactive (filtre, onglet, choix) | 41 | 25 | `SubTabPills` ou `TagChip` cliquable |
| **B** — chip ou badge descriptif, non cliquable | 55 | 40 | `TagChip` statique ou `CountBadge` |
| **C** — affordance d'ajout (tiretée) | 6 | 6 | `TagChip` variante *ajout* |
| **D** — bouton flottant de carte (`z-[1000]`, `absolute`) | 5 | 5 | **aucune** |

La famille **D** ne migre nulle part : ce sont des boutons d'action superposés à
une carte (« Autour de moi »), ronds par commodité. Les verser dans `TagChip`
serait exactement le détournement que chaque contrat refuse. Ils entrent dans la
liste des exceptions du garde-fou, avec cette raison.

## Structure des fichiers

- `src/features/shared/ui/TagChip.tsx` + `.stories.tsx` — **créer**.
- `src/features/shared/ui/SearchField.tsx` + `.stories.tsx` — **créer**.
- `src/features/shared/ui/SubTabPills.tsx` + `.stories.tsx` — **créer**.
- `src/features/shared/ui/ViewSwitcher.tsx` + `.stories.tsx` — **créer**.
- `src/test/pastilles-faites-main.test.ts` — **créer**. Le garde-fou et sa dette.
- `src/features/places/ui/CategoryTabs.tsx` — modifier (l'écran de référence).
- `.design-sync/entry.tsx` — modifier (quatre exports de plus).

---

### Task 1 : `TagChip`

**Files:**
- Create: `src/features/shared/ui/TagChip.tsx`
- Create: `src/features/shared/ui/TagChip.stories.tsx`
- Test: `src/features/shared/ui/TagChip.test.tsx`

**Interfaces:**
- Produces :

```ts
type TonChip = "defaut" | "selectionne" | "actif-doux" | "vide" | "ajout" | "suggere";
function TagChip(props: {
  ton?: TonChip;            // défaut : "defaut"
  couleur?: string;         // point de couleur en tête (ex. « valeur sûre »)
  compte?: number;          // compteur en retrait, à droite du libellé
  onClick?: () => void;     // sa présence décide : <button> ou <span>
  onRetirer?: () => void;   // ajoute la croix de retrait
  libelleRetrait?: string;  // aria-label de cette croix (obligatoire avec onRetirer)
  testId?: string;          // porté par le bouton lui-même, jamais par un wrapper
  children: ReactNode;
}): JSX.Element;

// `testId` et `aria-pressed` ne sont pas des ajouts « au cas où » : les e2e
// cliquent `list-tag-${slug}`, `origine-${o}` et `statut-${s}`, et lisent leur
// `aria-pressed`. Un chip qui ne les porte pas oblige l'écran à l'envelopper
// dans un `<span data-testid>` — et le sélecteur e2e viserait alors un élément
// qui ne reçoit pas le clic.
```

- [ ] **Step 1 : écrire le test qui décrit le contrat, pas le style**

Créer `src/features/shared/ui/TagChip.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagChip } from "./TagChip";

describe("TagChip", () => {
  // Le contrat du spec : « un chip qui filtre est un <button> ; un chip qui
  // décrit n'est pas cliquable. Le composant prend la décision, pas l'écran. »
  // Sans ça, un écran rend un <span> cliquable et le clavier ne l'atteint pas.
  it("n'est un bouton que lorsqu'il agit", () => {
    const { rerender } = render(<TagChip>Terrasse</TagChip>);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<TagChip onClick={() => {}}>Terrasse</TagChip>);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  // Un chip « vide » annonce zéro : le rendre cliquable promet un filtre qui
  // ne filtrera rien.
  it("refuse le clic quand il est vide", () => {
    const clic = vi.fn();
    render(<TagChip ton="vide" onClick={clic}>Coréen</TagChip>);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  // La croix est une seconde action DANS le chip : imbriquer un <button> dans
  // un <button> est invalide et le clavier s'y perd. Le chip doit donc rendre
  // deux éléments frères, pas emboîtés.
  it("sort la croix de retrait du bouton principal", () => {
    render(<TagChip onClick={() => {}} onRetirer={() => {}} libelleRetrait="Retirer Terrasse">Terrasse</TagChip>);
    const retrait = screen.getByRole("button", { name: "Retirer Terrasse" });
    expect(retrait.closest("button")).toBe(retrait);
  });
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

Run : `npx vitest run src/features/shared/ui/TagChip.test.tsx`
Expected : FAIL — `Failed to resolve import "./TagChip"`.

- [ ] **Step 3 : écrire le composant**

```tsx
import type { ReactNode } from "react";

type TonChip = "defaut" | "selectionne" | "actif-doux" | "vide" | "ajout" | "suggere";

// Relevé au canevas, bloc « Composants ». Le sélectionné pose --on-fill sur
// --ink : 16,70:1. Le vide garde --faint sur --surface-hover (3,69:1), ce qui
// est au-dessus du seuil des 3:1 applicable à un libellé désactivé.
//
// `actif-doux` n'est PAS au canevas : il vient du code existant, où les filtres
// de STATUT s'accumulent (plusieurs à la fois) là où un tag s'exclut (un seul).
// La nuance porte cette différence — l'aplatir sur `selectionne` ferait dire à
// l'interface qu'un filtre cumulatif est un choix unique.
const TON: Record<TonChip, string> = {
  defaut: "border border-line bg-surface-hover text-muted hover:border-line-strong hover:text-ink",
  selectionne: "bg-ink font-semibold text-on-fill",
  "actif-doux": "border border-accent/25 bg-accent-50 font-semibold text-accent",
  vide: "border border-line-soft bg-surface-hover text-faint opacity-50",
  ajout: "border border-dashed border-accent/40 bg-accent-50 text-accent",
  suggere: "border border-line bg-surface text-muted hover:border-accent/30 hover:text-ink",
};

export function TagChip({
  ton = "defaut", couleur, compte, onClick, onRetirer, libelleRetrait, testId, children,
}: {
  ton?: TonChip; couleur?: string; compte?: number;
  onClick?: () => void; onRetirer?: () => void; libelleRetrait?: string;
  testId?: string; children: ReactNode;
}) {
  const classe = `inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs transition-colors ${TON[ton]}`;
  const contenu = (
    <>
      {couleur && (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill" style={{ background: couleur }} />
      )}
      {children}
      {compte != null && <span className="opacity-50">{compte}</span>}
    </>
  );

  // Un chip qui décrit n'est pas cliquable : le rendre bouton promettrait une
  // action qui n'existe pas, et le lecteur d'écran l'annoncerait comme telle.
  const principal = onClick ? (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      // Un chip de filtre est un interrupteur : sans aria-pressed, un lecteur
      // d'écran ne dit pas si le filtre est posé.
      aria-pressed={ton === "selectionne" || ton === "actif-doux"}
      disabled={ton === "vide"}
      className={`${classe} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none`}
    >
      {contenu}
    </button>
  ) : (
    <span className={classe}>{contenu}</span>
  );

  if (!onRetirer) return principal;

  // La croix vit À CÔTÉ du chip, jamais dedans : un <button> imbriqué dans un
  // <button> est du HTML invalide, et le clavier n'atteint plus l'un des deux.
  return (
    <span className="inline-flex items-center gap-1">
      {principal}
      <button
        type="button"
        onClick={onRetirer}
        aria-label={libelleRetrait}
        className="grid h-5 w-5 place-items-center rounded-pill bg-badge text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        ×
      </button>
    </span>
  );
}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run src/features/shared/ui/TagChip.test.tsx`
Expected : PASS, 3 tests.

- [ ] **Step 5 : les stories, toutes variantes**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TagChip } from "./TagChip";

const meta: Meta<typeof TagChip> = { title: "Kit/TagChip", component: TagChip, args: { children: "Terrasse" } };
export default meta;
type Story = StoryObj<typeof TagChip>;

// Les huit états du canevas côte à côte : c'est le seul endroit où le survol
// et le focus se regardent.
export const TousLesEtats: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <TagChip>Terrasse</TagChip>
      <TagChip onClick={() => {}}>Terrasse</TagChip>
      <TagChip ton="selectionne" compte={11}>Terrasse</TagChip>
      <TagChip ton="actif-doux" onClick={() => {}}>Favori ✓</TagChip>
      <TagChip couleur="var(--color-kpi-green)">Valeur sûre</TagChip>
      <TagChip ton="vide" compte={0} onClick={() => {}}>Coréen</TagChip>
      <TagChip ton="ajout" onClick={() => {}}>+ Ajouter</TagChip>
      <TagChip ton="suggere" onClick={() => {}}>Occasion</TagChip>
      <TagChip onRetirer={() => {}} libelleRetrait="Retirer Terrasse">Terrasse</TagChip>
    </div>
  ),
};
```

- [ ] **Step 6 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): TagChip, et la décision d'être bouton ou non lui appartient"
```

---

### Task 2 : `SubTabPills`

**Files:**
- Create: `src/features/shared/ui/SubTabPills.tsx`
- Create: `src/features/shared/ui/SubTabPills.stories.tsx`
- Test: `src/features/shared/ui/SubTabPills.test.tsx`

**Interfaces:**
- Consumes : rien.
- Produces :

```ts
function SubTabPills<T extends string>(props: {
  options: { cle: T; libelle: string; compte?: number }[];
  valeur: T;
  onChange: (cle: T) => void;
  testId?: (cle: T) => string;   // data-testid par pastille ; les e2e s'en servent
  idOnglet?: (cle: T) => string; // id de chaque onglet
  ariaControls?: string;         // id du panneau que ces onglets commandent
  ariaLabel: string;             // nom du groupe d'onglets
}): JSX.Element;

// `idOnglet` et `ariaControls` ne sont pas facultatifs par confort : MESURÉ
// dans `CategoryTabs`, le panneau porte `aria-labelledby={`tab-${onglet}`}` et
// chaque onglet `aria-controls={config.panelId}`. Un composant qui ne les
// expose pas casse ce lien, et la relation onglet/panneau disparaît pour un
// lecteur d'écran sans qu'aucun test ne bronche.
```

- [ ] **Step 1 : écrire le test**

Créer `src/features/shared/ui/SubTabPills.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubTabPills } from "./SubTabPills";

const OPTIONS = [
  { cle: "favoris" as const, libelle: "Favoris", compte: 8 },
  { cle: "a_tester" as const, libelle: "À tester", compte: 12 },
];

describe("SubTabPills", () => {
  // Le rôle ARIA n'est pas décoratif : sans lui, un lecteur d'écran annonce
  // une rangée de boutons sans dire lequel est courant.
  it("annonce ses onglets et celui qui est courant", () => {
    render(<SubTabPills options={OPTIONS} valeur="favoris" onChange={() => {}} ariaLabel="Vue" />);
    const onglets = screen.getAllByRole("tab");
    expect(onglets).toHaveLength(2);
    expect(onglets[0]!.getAttribute("aria-selected")).toBe("true");
    expect(onglets[1]!.getAttribute("aria-selected")).toBe("false");
  });

  it("émet la clé choisie, pas l'index", () => {
    const onChange = vi.fn();
    render(<SubTabPills options={OPTIONS} valeur="favoris" onChange={onChange} ariaLabel="Vue" />);
    screen.getByRole("tab", { name: /À tester/ }).click();
    expect(onChange).toHaveBeenCalledWith("a_tester");
  });

  // Un compteur à zéro est une information (« rien ici »), pas une absence :
  // le masquer ferait disparaître la pastille au moment où elle explique le vide.
  it("affiche un compteur à zéro", () => {
    render(<SubTabPills options={[{ cle: "x" as const, libelle: "Vide", compte: 0 }]}
      valeur="x" onChange={() => {}} ariaLabel="Vue" />);
    expect(screen.getByRole("tab").textContent).toContain("0");
  });
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

Run : `npx vitest run src/features/shared/ui/SubTabPills.test.tsx`
Expected : FAIL — import non résolu.

- [ ] **Step 3 : écrire le composant**

```tsx
// Actif : aplat --ink, texte --on-fill (16,70:1), compteur en retrait à 55 %
// comme au canevas. Inactif : surface levée bordée, compteur en --faint.
export function SubTabPills<T extends string>({
  options, valeur, onChange, testId, idOnglet, ariaControls, ariaLabel,
}: {
  options: { cle: T; libelle: string; compte?: number }[];
  valeur: T;
  onChange: (cle: T) => void;
  testId?: (cle: T) => string;
  idOnglet?: (cle: T) => string;
  ariaControls?: string;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel}
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:none]">
      {options.map((o) => {
        const actif = o.cle === valeur;
        return (
          <button key={o.cle} type="button" role="tab" aria-selected={actif}
            id={idOnglet?.(o.cle)} aria-controls={ariaControls}
            data-testid={testId?.(o.cle)} onClick={() => onChange(o.cle)}
            className={`shrink-0 whitespace-nowrap rounded-pill px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              actif
                ? "bg-ink font-semibold text-on-fill"
                : "border border-line bg-surface-hover text-muted hover:border-line-strong hover:text-ink"
            }`}>
            {o.libelle}
            {o.compte != null && (
              <span className={`ml-1.5 ${actif ? "opacity-55" : "text-faint"}`}>{o.compte}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run src/features/shared/ui/SubTabPills.test.tsx`
Expected : PASS, 3 tests.

- [ ] **Step 5 : la story**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SubTabPills } from "./SubTabPills";

const meta: Meta<typeof SubTabPills> = { title: "Kit/SubTabPills", component: SubTabPills };
export default meta;
type Story = StoryObj<typeof SubTabPills>;

export const AvecCompteurs: Story = {
  render: () => (
    <SubTabPills ariaLabel="Vue" valeur="favoris" onChange={() => {}}
      options={[
        { cle: "favoris", libelle: "Favoris", compte: 8 },
        { cle: "a_tester", libelle: "À tester", compte: 12 },
      ]} />
  ),
};
```

- [ ] **Step 6 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): SubTabPills — des onglets qui s'annoncent, et des compteurs qui comptent"
```

---

### Task 3 : `ViewSwitcher`

**Files:**
- Create: `src/features/shared/ui/ViewSwitcher.tsx`
- Create: `src/features/shared/ui/ViewSwitcher.stories.tsx`
- Test: `src/features/shared/ui/ViewSwitcher.test.tsx`

**Interfaces:**
- Consumes : rien.
- Produces :

```ts
function ViewSwitcher<T extends string>(props: {
  options: { cle: T; icone: ReactNode; libelle: string }[];
  valeur: T;
  onChange: (cle: T) => void;
  testId?: (cle: T) => string;
}): JSX.Element;
```

**Le canevas montre DEUX segments** (liste / vignettes) parce qu'il a décidé que
« la carte est une destination ». `CategoryTabs` en a trois aujourd'hui. Ce
composant ne tranche pas : il prend `options` et en rend autant qu'on lui en
donne. Retirer la carte du commutateur est un changement d'écran, pas de
composant — il appartient au **lot 4**. Le forcer ici changerait la navigation
sans que personne ne l'ait demandé.

- [ ] **Step 1 : écrire le test**

Créer `src/features/shared/ui/ViewSwitcher.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewSwitcher } from "./ViewSwitcher";

const OPTIONS = [
  { cle: "liste" as const, icone: <span>☰</span>, libelle: "Liste" },
  { cle: "vignettes" as const, icone: <span>▦</span>, libelle: "Vignettes" },
];

describe("ViewSwitcher", () => {
  // L'icône seule ne dit rien à un lecteur d'écran : le libellé doit être le
  // nom accessible, et l'état courant doit s'annoncer.
  it("nomme chaque vue et annonce la courante", () => {
    render(<ViewSwitcher options={OPTIONS} valeur="liste" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Liste" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Vignettes" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("émet la clé choisie", () => {
    const onChange = vi.fn();
    render(<ViewSwitcher options={OPTIONS} valeur="liste" onChange={onChange} />);
    screen.getByRole("button", { name: "Vignettes" }).click();
    expect(onChange).toHaveBeenCalledWith("vignettes");
  });

  // Les e2e cliquent les segments par leur data-testid (`view-carte`…) : il doit
  // siéger sur le BOUTON, pas sur le rail qui les contient. Écrit de façon à
  // échouer si on le déplaçait sur l'enveloppe — constater sa simple présence
  // quelque part ne protégerait de rien.
  it("place testId sur le segment interactif", () => {
    render(<ViewSwitcher options={OPTIONS} valeur="liste" onChange={() => {}}
      testId={(v) => `view-${v}`} />);
    expect(screen.getByRole("button", { name: "Liste" }).getAttribute("data-testid")).toBe("view-liste");
  });

  // Le composant ne décide pas du nombre de vues : la carte en est une chez
  // Restos tant que le lot 4 ne l'a pas sortie du commutateur.
  it("rend autant de segments qu'on lui en donne", () => {
    render(<ViewSwitcher valeur="liste" onChange={() => {}}
      options={[...OPTIONS, { cle: "carte" as const, icone: <span>◍</span>, libelle: "Carte" }]} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

Run : `npx vitest run src/features/shared/ui/ViewSwitcher.test.tsx`
Expected : FAIL — import non résolu.

- [ ] **Step 3 : écrire le composant**

```tsx
import type { ReactNode } from "react";

// Un rail bordé qui contient des segments : actif en aplat --ink, survol en
// --badge. Le canevas donne 11 px au rail et 8 px aux segments ; on emploie
// --radius-control (10 px) pour le rail et --radius-tile… non : les deux
// jetons ronds du lot 0 sont card (12) et control (10). Le rail prend control,
// les segments prennent control aussi — l'écart d'un pixel du canevas ne
// justifie pas un jeton de plus.
export function ViewSwitcher<T extends string>({
  options, valeur, onChange, testId,
}: {
  options: { cle: T; icone: ReactNode; libelle: string }[];
  valeur: T;
  onChange: (cle: T) => void;
  testId?: (cle: T) => string;
}) {
  return (
    <div className="flex shrink-0 gap-1 rounded-control border border-line bg-surface-hover p-0.5">
      {options.map((o) => {
        const actif = o.cle === valeur;
        return (
          <button key={o.cle} type="button" aria-pressed={actif} aria-label={o.libelle}
            data-testid={testId?.(o.cle)} onClick={() => onChange(o.cle)}
            className={`grid h-7 w-9 place-items-center rounded-control transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              actif ? "bg-ink text-on-fill" : "text-muted hover:bg-badge hover:text-ink"
            }`}>
            {o.icone}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run src/features/shared/ui/ViewSwitcher.test.tsx`
Expected : PASS, 4 tests.

- [ ] **Step 5 : la story**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ViewSwitcher } from "./ViewSwitcher";

const meta: Meta<typeof ViewSwitcher> = { title: "Kit/ViewSwitcher", component: ViewSwitcher };
export default meta;
type Story = StoryObj<typeof ViewSwitcher>;

export const DeuxVues: Story = {
  render: () => (
    <ViewSwitcher valeur="liste" onChange={() => {}}
      options={[
        { cle: "liste", icone: <span aria-hidden>☰</span>, libelle: "Liste" },
        { cle: "vignettes", icone: <span aria-hidden>▦</span>, libelle: "Vignettes" },
      ]} />
  ),
};
```

- [ ] **Step 6 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): ViewSwitcher, qui ne décide pas du nombre de vues"
```

---

### Task 4 : `SearchField`

**Files:**
- Create: `src/features/shared/ui/SearchField.tsx`
- Create: `src/features/shared/ui/SearchField.stories.tsx`
- Test: `src/features/shared/ui/SearchField.test.tsx`

**Interfaces:**
- Consumes : rien.
- Produces :

```ts
function SearchField(props: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;          // sert aussi d'aria-label
  horsLigne?: boolean;          // éteint et inerte
  libelleEffacer: string;       // aria-label de la croix
  testId?: string;
  className?: string;
}): JSX.Element;
```

`Input` existe mais ne porte ni icône, ni effacement, ni état hors connexion :
il reste le champ générique des formulaires. Ce composant-ci est le champ de
**recherche**, et il ne connaît pas la recherche — voir le contrat du spec.

- [ ] **Step 1 : écrire le test**

Créer `src/features/shared/ui/SearchField.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchField } from "./SearchField";

describe("SearchField", () => {
  // La croix n'a de sens que s'il y a quelque chose à effacer. L'afficher à
  // vide met une cible morte sous le doigt.
  it("ne montre la croix que lorsqu'il y a du texte", () => {
    const { rerender } = render(
      <SearchField valeur="" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />);
    expect(screen.queryByRole("button", { name: "Effacer" })).toBeNull();
    rerender(
      <SearchField valeur="coréen" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />);
    expect(screen.getByRole("button", { name: "Effacer" })).toBeTruthy();
  });

  it("efface en émettant une chaîne vide", () => {
    const onChange = vi.fn();
    render(<SearchField valeur="coréen" onChange={onChange} placeholder="Nom…" libelleEffacer="Effacer" />);
    screen.getByRole("button", { name: "Effacer" }).click();
    expect(onChange).toHaveBeenCalledWith("");
  });

  // Les e2e ciblent le champ par son data-testid (`places-search`) : il doit
  // siéger sur l'<input>, pas sur le <label> qui l'enveloppe. Écrit de façon à
  // échouer si on le déplaçait.
  it("place testId sur le champ, pas sur son étiquette", () => {
    render(<SearchField valeur="" onChange={() => {}} placeholder="Nom…"
      libelleEffacer="Effacer" testId="places-search" />);
    expect(screen.getByRole("searchbox").getAttribute("data-testid")).toBe("places-search");
  });

  // Hors connexion, le champ doit être inerte POUR DE BON : un champ
  // simplement grisé se laisse encore remplir, et la frappe part dans le vide.
  it("est réellement inerte hors connexion", () => {
    render(<SearchField valeur="" onChange={() => {}} placeholder="Hors connexion"
      libelleEffacer="Effacer" horsLigne />);
    expect(screen.getByRole("searchbox").hasAttribute("disabled")).toBe(true);
  });
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

Run : `npx vitest run src/features/shared/ui/SearchField.test.tsx`
Expected : FAIL — import non résolu.

- [ ] **Step 3 : écrire le composant**

```tsx
import { Search, X } from "lucide-react";

// Quatre états au canevas : repos, survol, focus (bordure 1,5 px en accent et
// halo --accent-50), hors connexion (éteint). Le focus est porté par
// `focus-within` parce que c'est le CONTENEUR qui se pare, pas l'input nu.
export function SearchField({
  valeur, onChange, placeholder, horsLigne, libelleEffacer, testId, className = "",
}: {
  valeur: string; onChange: (v: string) => void; placeholder: string;
  horsLigne?: boolean; libelleEffacer: string; testId?: string; className?: string;
}) {
  return (
    <label
      className={`flex min-w-0 items-center gap-2.5 rounded-card border bg-surface-hover px-3.5 py-2.5 transition-colors ${
        horsLigne
          ? "border-line-soft opacity-60"
          : "border-line hover:border-line-strong hover:bg-badge focus-within:border-accent focus-within:bg-surface-hover focus-within:ring-3 focus-within:ring-accent-50"
      } ${className}`}
    >
      <Search size={15} aria-hidden className={`shrink-0 ${horsLigne ? "text-faint" : "text-muted"}`} />
      <input
        type="search"
        data-testid={testId}
        value={valeur}
        disabled={horsLigne}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {valeur !== "" && !horsLigne && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={libelleEffacer}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-pill bg-badge text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X size={9} aria-hidden />
        </button>
      )}
    </label>
  );
}
```

- [ ] **Step 4 : lancer**

Run : `npx vitest run src/features/shared/ui/SearchField.test.tsx`
Expected : PASS, 4 tests.

- [ ] **Step 5 : la story**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchField } from "./SearchField";

const meta: Meta<typeof SearchField> = { title: "Kit/SearchField", component: SearchField };
export default meta;
type Story = StoryObj<typeof SearchField>;

// Le survol et le focus ne se scriptent pas : ils se regardent ici.
export const QuatreEtats: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2.5">
      <SearchField valeur="" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />
      <SearchField valeur="coréen" onChange={() => {}} placeholder="Nom, ville, tag…" libelleEffacer="Effacer" />
      <SearchField valeur="" onChange={() => {}} placeholder="Hors connexion" libelleEffacer="Effacer" horsLigne />
    </div>
  ),
};
```

- [ ] **Step 6 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "feat(design): SearchField, qui rend un champ et ne connaît pas la recherche"
```

---

### Task 5 : le garde-fou, et la dette des 102

**Files:**
- Create: `src/test/pastilles-faites-main.test.ts`

**Interfaces:**
- Consumes : `SRC`, `fichiersSources`, `sansCommentaires` de `src/test/fichiersSources.ts` (posés par le lot 6A).
- Produces : rien.

Même dispositif qu'en 6A : une liste **close** de ce qui est légitime, et une
liste **de dette** que 6B-2 et 6B-3 vident. Sans lui, les quatre composants
s'ajoutent aux 107 copies au lieu de les remplacer.

- [ ] **Step 1 : écrire le garde-fou avec une dette vide**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources, sansCommentaires } from "./fichiersSources";

// Une pastille dessinée à la main est la dette que le lot 6 supprime : 107
// copies existaient, et rien n'empêchait la 108e. `rounded-pill` seul ne suffit
// pas à incriminer — c'est la conjonction avec un padding horizontal qui fait
// une pastille plutôt qu'un rond.
const PASTILLE = /rounded-(pill|full)[^"'`]*\bpx-/;

// Liste CLOSE. Chaque entrée porte sa raison.
const AUTORISES: Record<string, string> = {
  // Seuls les composants que le motif attrape RÉELLEMENT figurent ici. Vérifié
  // sur l'arbre : ViewSwitcher et SearchField n'y sont pas, leurs éléments ronds
  // n'ayant pas de padding horizontal. Les y inscrire « au cas où » accorderait
  // d'avance une permission que personne n'aurait examinée — c'est précisément
  // la pourriture que ce garde-fou existe pour empêcher.
  "features/shared/ui/TagChip.tsx": "le composant lui-même",
  "features/shared/ui/SubTabPills.tsx": "le composant lui-même",
  "features/shared/ui/CountBadge.tsx": "le composant lui-même",
  "features/places/ui/CategoryMap.tsx": "bouton d'action flottant sur la carte (« Autour de moi »), rond par commodité et non pastille",
  "features/places/ui/CategoryMapCombined.tsx": "idem, carte combinée",
  "features/vins/ui/CaveMap.tsx": "idem, carte de la cave",
  "features/activites/ui/CarteActivites.tsx": "idem, carte des activités",
};

// TEMPORAIRE. Rempli au step 2 depuis la sortie réelle. Vidé par 6B-2 et 6B-3.
const DETTE: Record<string, string> = {};

describe("les pastilles", () => {
  it("ne sont dessinées à la main nulle part", () => {
    const connus = { ...AUTORISES, ...DETTE };
    const coupables = fichiersSources()
      .filter((f) => f.startsWith("features/") || f.startsWith("app/"))
      .filter((f) => !(f in connus))
      .filter((f) => PASTILLE.test(sansCommentaires(readFileSync(path.join(SRC, f), "utf8"))))
      .sort();
    expect(coupables).toEqual([]);
  });

  // Même garde qu'en 6A : une dette qu'on oublie de vider redevient une liste
  // d'exceptions, et la dette est payée sans que personne ne le sache.
  it("ne gardent aucune dette déjà payée", () => {
    const payees = Object.keys(DETTE)
      .filter((f) => !PASTILLE.test(sansCommentaires(readFileSync(path.join(SRC, f), "utf8"))))
      .sort();
    expect(payees).toEqual([]);
  });
});
```

- [ ] **Step 2 : lancer, et remplir `DETTE` depuis la sortie réelle**

Run : `npx vitest run src/test/pastilles-faites-main.test.ts`
Expected : **FAIL**, avec environ soixante fichiers.

Recopier la liste et remplir `DETTE`, chaque entrée portant sa famille et donc
son lot : `"6B-2"` pour la famille A (pastille interactive), `"6B-3"` pour les
familles B et C.

**La règle de classement n'est pas « quelle famille domine » mais « le fichier
sort-il de la dette en une fois ».** Le second test de ce garde-fou exige qu'une
entrée retirée n'ait PLUS AUCUNE pastille faite main. Un fichier qui en contient
une interactive et une descriptive ne peut donc pas sortir en 6B-2 : il va en
**6B-3**. Seuls les fichiers dont TOUTES les pastilles sont interactives vont en
6B-2.

Relevé attendu, mesuré le 2026-09-11 : **57 fichiers**, dont **23** purement
interactifs (6B-2) et **34** mixtes ou descriptifs (6B-3). Un classement
pré-calculé est disponible dans le dossier de travail SDD
(`dette-t5.txt`), avec pour chaque fichier le compte `n/m interactives`.

**C'est une heuristique, pas une mesure.** Elle lit une fenêtre de quelques
lignes autour de chaque `rounded-*…px-` et y cherche `<button`, `<label`,
`aria-pressed`, `role="tab"`, `onClick` ou un ternaire de classe. Une première
version qui ne regardait QUE la ligne du `rounded-full` classait
`FiltresActivites` en descriptif alors qu'il porte des filtres cliquables — le
ternaire d'état actif vivait sur la ligne suivante. Vérifier au cas par cas en
6B-2 et 6B-3 ; ce classement sert à ordonner le travail, pas à le dispenser.

Ne rien inventer : si la sortie contient un fichier que le tri n'a pas classé,
le dire dans le rapport plutôt que de le ranger au jugé.

- [ ] **Step 3 : vérifier que tout est vert**

Run : `npx vitest run src/test/pastilles-faites-main.test.ts`
Expected : PASS, 2 tests.

- [ ] **Step 4 : prouver qu'il mord**

Ajouter `<span className="rounded-pill px-3 py-1">x</span>` dans
`src/features/shared/ui/Card.tsx`, lancer.
Expected : FAIL avec `features/shared/ui/Card.tsx`. Retirer, PASS. Recopier les
deux sorties.

- [ ] **Step 5 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add -A
git commit -m "test(design): une pastille dessinée à la main fait désormais échouer la suite"
```

---

### Task 6 : l'écran de référence

**Files:**
- Modify: `src/features/places/ui/CategoryTabs.tsx` (lignes 107-120, 128-152, 155-196)
- Modify: `src/test/pastilles-faites-main.test.ts` (retirer son entrée de `DETTE`)

**Interfaces:**
- Consumes : `TagChip`, `SubTabPills`, `ViewSwitcher`, `SearchField` (tâches 1 à 4).
- Produces : rien.

`CategoryTabs` héberge les quatre composants à lui seul — sous-onglets, champ de
recherche, commutateur de vue, filtres de tags et de statut. C'est l'écran qui
prouve que les composants tiennent, et le seul que ce plan migre.

- [ ] **Step 1 : les sous-onglets**

Remplacer le bloc `sousOnglets` (lignes 107-120) par :

```tsx
  const sousOnglets = (
    <SubTabPills ariaLabel={tr("onglets.aria")} valeur={onglet} onChange={selectOnglet}
      testId={tabTestId} idOnglet={(o) => `tab-${o}`} ariaControls={config.panelId}
      options={ONGLETS.map((o) => ({ cle: o, libelle: tr(`onglets.${o}`) }))} />
  );
```

`idOnglet` et `ariaControls` sont obligatoires ici, et la tâche 2 les a prévus :
le panneau de la ligne 215 porte `aria-labelledby={`tab-${onglet}`}`. Les
omettre romprait le lien onglet/panneau sans qu'aucun test ne bronche.

**PIÈGE — `idOnglet` n'est PAS `tabTestId`.** `tabTestId` (dans
`categoryUiConfig.ts:81`) remplace les soulignés par des tirets :
`a_tester` → `tab-a-tester`. L'`id` de l'onglet, lui, garde le souligné
(`tab-a_tester`), parce que c'est cette forme que le panneau cite dans son
`aria-labelledby`. Passer `tabTestId` aux deux endroits casserait le lien pour
un lecteur d'écran, et rien ne le signalerait : les deux attributs existeraient,
simplement ils ne se répondraient plus.

Si la clé `onglets.aria` n'existe pas, l'ajouter aux **quatre** langues : un
`role="tablist"` sans nom accessible est annoncé comme un groupe anonyme.

- [ ] **Step 2 : le champ de recherche et le commutateur**

Dans le bloc `filtres`, remplacer le `<label>` de recherche par :

```tsx
          <SearchField className="flex-1" valeur={q} onChange={setQ}
            placeholder={tr("rechercherPlaceholder")} libelleEffacer={t("effacer")}
            testId="places-search" />
```

et le rail des vues par :

```tsx
          <ViewSwitcher valeur={view} onChange={setView} testId={(v) => `view-${v}`}
            options={[
              { cle: "liste", icone: <span aria-hidden>☰</span>, libelle: t("vueListe") },
              { cle: "vignettes", icone: <span aria-hidden>▦</span>, libelle: t("vueVignettes") },
              { cle: "carte", icone: <span aria-hidden>◍</span>, libelle: t("vueCarte") },
            ]} />
```

La carte reste un segment : la sortir du commutateur appartient au lot 4.

**Les espaces de noms, vérifiés clé par clé dans les quatre langues** —
`CategoryTabs` emploie DEUX fonctions de traduction, `t = useTranslations("places")`
et `tr = useTranslations(config.ns)` où `config.ns` vaut `restos` ou `hotels`.
Prendre la mauvaise donne une clé brute à l'écran sans casser aucun test :

| Clé | Où elle est | À employer |
|---|---|---|
| `places.vueListe` / `vueVignettes` / `vueCarte` | existe | `t("vueListe")`… |
| `places.tagTous` | existe | `t("tagTous")` |
| `restos.rechercherPlaceholder` / `hotels.…` | existe | `tr("rechercherPlaceholder")` |
| `places.effacer` | **N'EXISTE PAS** | à créer |
| `restos.onglets.aria` / `hotels.onglets.aria` | **N'EXISTE PAS** | à créer |

Créer les deux clés manquantes dans **les quatre** fichiers `messages/*.json` :

- `places.effacer` — « Effacer la recherche » (fr), et sa traduction en en/es/it.
  Il existe déjà un `famille.proches.effacer` = « Effacer la recherche » dont on
  peut reprendre les quatre valeurs.
- `restos.onglets.aria` **et** `hotels.onglets.aria` — le nom accessible du
  groupe d'onglets, ex. « Filtrer les adresses ». Un `role="tablist"` sans nom
  est annoncé comme un groupe anonyme.

Sans elles, `next-intl` affiche la clé brute à l'écran et aucun test ne bronche.

- [ ] **Step 3 : les filtres de tags et de statut**

Remplacer les trois groupes (origine, statuts, tags) par des `TagChip`. Exemple
pour les tags, lignes 183-195 :

```tsx
          <TagChip ton={tag === null ? "selectionne" : "defaut"} onClick={() => setTag(null)}>
            {t("tagTous")}
          </TagChip>
          {tagsDispo.map((tg) => (
            <TagChip key={tg.slug} ton={tag === tg.slug ? "selectionne" : "defaut"}
              onClick={() => setTag(tg.slug)}>
              {tg.label}
            </TagChip>
          ))}
```

Les `data-testid` (`list-tag-tous`, `list-tag-${slug}`, `origine-${o}`,
`statut-${s}`) et les `aria-pressed` sont employés par les e2e ; `TagChip` les
porte nativement (tâche 1), sur le bouton lui-même. Les passer par `testId`.

Ne **jamais** contourner en enveloppant un chip dans un `<span data-testid>` :
le sélecteur e2e viserait alors un élément qui ne reçoit pas le clic, et le test
échouerait pour une raison sans rapport avec ce qu'il éprouve.

Les trois groupes n'ont pas le même ton sélectionné : les tags et l'origine
posent `bg-ink` (donc `ton="selectionne"`), mais les **statuts** posent
`border-accent/25 bg-accent-50 text-accent`, un quatrième ton. Ne pas l'aplatir
sur `selectionne` — la nuance distingue un filtre exclusif (un seul tag) d'un
filtre cumulatif (plusieurs statuts à la fois). Ajouter un ton `actif-doux` à
`TagChip` et le dire dans le rapport.

- [ ] **Step 4 : `CategoryTabs` RESTE en dette — ne pas retirer son entrée**

Écrit d'abord à l'envers dans ce plan, et corrigé après mesure. Le fichier porte
**trois autres pastilles** que cette tâche ne touche pas :

- une chip descriptive teintée pour l'origine (`bg-kpi-amber-bg`), que `TagChip`
  ne sait pas rendre — il n'a pas de ton coloré ;
- deux **boutons d'action** en forme de pastille (« marquer la visite » en vert,
  « passer en favori » en accent), qui ne sont pas des chips : les verser dans
  `TagChip` serait le détournement que son contrat refuse.

La règle de la dette s'applique telle quelle : un fichier ne sort qu'une fois
**entièrement** propre, donc `CategoryTabs` attend 6B-3. Ne pas céder à la
tentation de vider une ligne de liste en tordant un composant — c'est
exactement l'inverse de ce que ce lot construit.

- [ ] **Step 5 : les tests de l'écran**

Run : `npx vitest run src/features/places`
Expected : PASS. Un test qui cherchait une classe (`bg-ink`, `rounded-full`)
échouerait : le corriger vers le rôle ou le `data-testid`, jamais vers la classe.

- [ ] **Step 6 : les e2e, qui sont ici le vrai juge**

```bash
npx supabase db reset && npm run test:e2e
```

Expected : 194/194. `CategoryTabs` est l'écran des Restos et des Hôtels : il est
traversé par une grande part de la suite. C'est le seul endroit où un
`data-testid` perdu ou un `aria-pressed` disparu se voit.

- [ ] **Step 7 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
git add -A
git commit -m "feat(design): l'écran des adresses passe aux quatre composants"
```

---

### Task 7 : le kit, et le coup d'œil

**Files:**
- Modify: `.design-sync/entry.tsx`

- [ ] **Step 1 : exporter les quatre composants**

Ajouter à `.design-sync/entry.tsx`, avec des imports **relatifs** (l'alias `@/`
n'est pas résolu par le convertisseur) :

```tsx
export { TagChip } from "../src/features/shared/ui/TagChip";
export { SearchField } from "../src/features/shared/ui/SearchField";
export { SubTabPills } from "../src/features/shared/ui/SubTabPills";
export { ViewSwitcher } from "../src/features/shared/ui/ViewSwitcher";
```

- [ ] **Step 2 : construire le storybook de référence**

```bash
npx storybook build -c .storybook -o .design-sync/sb-reference
```

Expected : construction réussie, les quatre nouveaux composants présents.

Si une story échoue sur une clé next-intl absente, étendre `storyMessages` dans
`.storybook/messages.ts` — c'est le risque de re-sync connu du kit.

- [ ] **Step 3 : la suite complète**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
npx supabase db reset && npm run test:e2e
```

- [ ] **Step 4 : le coup d'œil du PO**

`npm run dev`, onglet Restaurants, **dans les deux thèmes** :

- les sous-onglets, et celui qui est actif ;
- le champ de recherche au repos, au survol, **au focus** (bordure accent et
  halo), et avec sa croix ;
- le commutateur de vue, ses trois segments ;
- les filtres de tags, sélectionnés et non sélectionnés.

Signaler que `--line-strong` (le survol) est la valeur **dérivée** du lot 6A
qui n'a toujours pas été validée à l'œil : c'est ici qu'elle se voit enfin, sur
un chip et un champ.

- [ ] **Step 5 : commit**

```bash
git add -A
git commit -m "chore(design): les quatre composants entrent dans le kit"
```

---

## Ce que ce plan ne fait pas

- Il ne migre **que** `CategoryTabs`. Les ~60 autres fichiers sont en dette
  déclarée : famille A pour 6B-2, familles B et C pour 6B-3.
- Il ne touche **pas** aux cinq boutons flottants de carte (famille D) : ce sont
  des boutons d'action ronds, pas des pastilles. Ils sont dans la liste close.
- Il ne sort **pas** la carte du commutateur de vue, bien que le canevas dise
  « la carte est une destination » : c'est un changement de navigation, donc du
  lot 4.
- Il ne construit ni `StatusToggle` ni `PlaceMapMarker` — lot 6C.
