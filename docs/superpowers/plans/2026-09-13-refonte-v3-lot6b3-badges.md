# Refonte v3 — lot 6B-3 : les badges descriptifs, et un contraste qui ne tenait pas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** donner à `TagChip` les trois tons sémantiques qui lui manquent, corriger
au passage un ton livré sous le seuil de contraste, et ramener la dette des
pastilles de 54 à zéro.

**Architecture :** les badges teintés du dépôt écrivent leur libellé **dans la
couleur du ton** sur un fond de la même couleur à 14 %. Mesuré sur les valeurs
réelles des jetons, cela échoue en thème clair. Les tons prennent donc la forme
que le lot 6A avait déjà retenue pour `StatTile` : fond teinté, bordure teintée,
**texte en `--ink`**.

**Tech Stack :** Next.js 16, React 19, Tailwind v4, Vitest, Playwright.

**Spec :** `docs/superpowers/specs/2026-09-11-refonte-v3-lot6-composants-design.md`

## Global Constraints

- **Aucune teinte ni aucun rayon littéral**, **aucun `text-white`**, **aucune pastille sans raison écrite** : quatre garde-fous les refusent.
- **Aucune nouvelle dépendance.** `fireEvent` de `@testing-library/react`.
- Toute prop publique a un test qui échoue si elle cesse de fonctionner.
- Tout garde-fou est **éprouvé par cassure délibérée**, l'échec tombant sur **l'assertion visée** — isoler avec `npx vitest run <fichier> -t "<nom>"`.
- **`git add <chemins>` uniquement.**
- **Avant toute mesure, `git status --porcelain`.** S'il n'est pas vide, la mesure n'est pas celle de la branche.
- **Ne PAS lancer `supabase db reset`** : d'autres sessions partagent cette instance et un reset détruit leurs migrations en cours. Employer `npx supabase migration up --local`.

## Le défaut mesuré, et pourquoi il commande la forme des tons

Valeurs **réelles** des jetons, thème clair, texte teinté sur son propre fond :

| Paire | Contraste | Seuil |
|---|---|---|
| `--accent` sur `--accent-50` — **le ton `actif-doux`, en production** | **4,17:1** | ❌ 4,5 |
| `--kpi-green` sur `--kpi-green-bg` | **4,36:1** | ❌ |
| `--kpi-amber` sur `--kpi-amber-bg` | **4,27:1** | ❌ |
| `--danger` sur `--danger-bg` | 5,72:1 | ✓ |

Trois des quatre échouent, sur des libellés de 10 à 11 px — la taille où le
seuil compte le plus. Nommer des tons sémantiques sans corriger cela
industrialiserait le défaut sur 54 sites.

Avec un texte en `--ink` sur le même fond : **11,79 à 16,66:1** dans les deux
thèmes. Ce n'est pas une invention : `StatTile` (lot 6A) pose déjà son chiffre en
`--ink` sur un fond teinté bordé.

**Conséquence assumée** : les libellés cessent d'être colorés. Le ton reste porté
par le fond et la bordure.

## Structure des fichiers

- `src/features/shared/ui/TagChip.tsx` + `.test.tsx` + `.stories.tsx` — trois tons de plus, et `actif-doux` corrigé.
- `src/app/theme.test.ts` — quatre seuils de plus.
- `src/test/pastilles-raisons.ts` — la dette descend à zéro.
- 39 fichiers d'écran — 54 sites migrés.

---

### Task 1 : les tons sémantiques, et le seuil qui les tient

**Files:**
- Modify: `src/app/theme.test.ts`
- Modify: `src/features/shared/ui/TagChip.tsx`
- Modify: `src/features/shared/ui/TagChip.test.tsx`
- Modify: `src/features/shared/ui/TagChip.stories.tsx`

**Interfaces:**
- Produces : `TonChip` gagne `"succes" | "alerte" | "danger"`. `actif-doux` change d'apparence (texte `--ink`), pas de nom.

- [ ] **Step 1 : écrire les seuils AVANT les tons**

Dans `src/app/theme.test.ts`, ajouter à `SEUILS` :

```ts
  // Les badges teintés posent leur libellé sur un fond de la même couleur à
  // 14 %. Écrit dans la couleur du ton, ce libellé tombe à 4,17–4,36:1 en thème
  // clair ; en --ink il tient 11,79 à 16,66:1. Ces seuils tiennent la décision.
  ["ink", "kpi-green-bg", 4.5],
  ["ink", "kpi-amber-bg", 4.5],
  ["ink", "danger-bg", 4.5],
  ["ink", "accent-50", 4.5],
```

- [ ] **Step 2 : lancer, et constater ce qui manque**

Run : `npx vitest run src/app/theme.test.ts`

Expected : les quatre lignes **échouent en thème sombre** — `--kpi-green-bg` y
vaut `rgba(62,213,152,0.14)`, une valeur alpha que la fonction `contraste` du
fichier ne sait pas lire (elle exige `#rrggbb`).

C'est un vrai manque de l'outil de mesure, pas un détail : **tant qu'il ne sait
pas composer une couleur alpha sur son fond, aucun seuil ne peut couvrir un
fond teinté.** Étendre `luminance`/`contraste` pour accepter `rgba(r,g,b,a)` en
composant sur `--surface`, et le dire dans le rapport.

- [ ] **Step 3 : étendre la mesure aux couleurs alpha**

Dans `src/app/theme.test.ts`, avant `contraste` :

```ts
/** Une couleur alpha composée sur son fond, rendue en `#rrggbb`. */
export function surFond(couleur: string, fond: string): string {
  const m = couleur.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (!m) return couleur;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const f = parseInt(fond.slice(1), 16);
  const mele = (i: number, d: number) =>
    Math.round(Number(m[i]) * a + ((f >> d) & 255) * (1 - a));
  return "#" + [[1, 16], [2, 8], [3, 0]].map(([i, d]) => mele(i!, d!).toString(16).padStart(2, "0")).join("");
}
```

et, dans le `it.each` des seuils, composer chaque valeur sur `--surface` avant de
mesurer.

- [ ] **Step 4 : vérifier que les quatre seuils passent**

Run : `npx vitest run src/app/theme.test.ts`
Expected : PASS. Si `ink` sur `accent-50` échoue encore, c'est que `actif-doux`
n'a pas encore changé — c'est le step suivant.

- [ ] **Step 5 : les trois tons, et la correction d'`actif-doux`**

Dans `TagChip.tsx` :

```ts
type TonChip =
  | "defaut" | "selectionne" | "actif-doux" | "vide" | "ajout" | "suggere"
  | "succes" | "alerte" | "danger";

const TON: Record<TonChip, string> = {
  // …les six existants…

  // `actif-doux` posait son libellé en --accent sur --accent-50 : 4,17:1 en
  // thème clair, sous le seuil. Le texte passe en --ink (12,33 à 16,36:1) ; le
  // ton reste porté par le fond et la bordure, comme StatTile au lot 6A.
  "actif-doux": "border border-accent/25 bg-accent-50 font-semibold text-ink",

  // Trois tons SÉMANTIQUES, pour des badges qui disent un état métier et non
  // une sélection. Même forme : fond teinté, bordure teintée, texte --ink.
  succes: "border border-kpi-green/25 bg-kpi-green-bg text-ink",
  alerte: "border border-kpi-amber/25 bg-kpi-amber-bg text-ink",
  danger: "border border-danger/25 bg-danger-bg text-ink",
};
```

`aria-pressed` ne doit PAS être posé sur les trois nouveaux : ce sont des
badges, pas des interrupteurs. Étendre la condition existante en conséquence.

- [ ] **Step 6 : les tests des nouveaux tons**

Dans `TagChip.test.tsx`, ajouter un cas qui vérifie que les trois tons
sémantiques **ne portent pas** `aria-pressed`, même rendus avec `onClick` — et
prouver qu'il mord en l'ajoutant temporairement à la liste des tons pressables.

- [ ] **Step 7 : la story**

Étendre `TousLesEtats` des trois tons, pour qu'ils se regardent côte à côte.

- [ ] **Step 8 : vérification et commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add src/app/theme.test.ts src/features/shared/ui/TagChip.tsx src/features/shared/ui/TagChip.test.tsx src/features/shared/ui/TagChip.stories.tsx
git commit -m "fix(design): les badges teintés écrivaient sous le seuil, et actif-doux avec eux"
```

---

### Task 2 : les sept chips interactifs

**Files:**
- Modify: `src/features/famille/ui/DocumentTunnel.tsx:97,104`
- Modify: `src/features/places/ui/CategoryMapCombined.tsx:72,78`
- Modify: `src/features/vins/ui/MaDegustationForm.tsx:94`
- Modify: `src/features/voyages/ui/ParticipantsList.tsx:189`
- Modify: `src/features/voyages/ui/VoyagesList.tsx:60`
- Modify: `src/test/pastilles-raisons.ts`

Ce sont de vrais chips (`aria-pressed` + ternaire + `onClick`), que le grain du
fichier cachait dans des fichiers mixtes. Chacun prend `selectionne`/`defaut`,
sauf si son actif est déjà doux (`bg-accent-50`), auquel cas `actif-doux`.

- [ ] **Step 1 : migrer les sept, un par un**

Lire chaque site avant de le remplacer : l'actif n'est pas toujours `bg-ink`.
Conserver **tous** les `data-testid` — les e2e cliquent dessus.

- [ ] **Step 2 : retirer leurs entrées de dette**

Dans `pastilles-raisons.ts`, retirer les sept lignes `dette:` correspondantes.
Le premier garde-fou échoue si le compte ne suit pas : c'est voulu.

- [ ] **Step 3 : les e2e des écrans touchés**

```bash
npx playwright test e2e/famille-documents.spec.ts e2e/vins.spec.ts e2e/voyages.spec.ts e2e/places.spec.ts
```

- [ ] **Step 4 : vérification et commit**

---

### Task 3 : les quarante-quatre badges descriptifs

**Files:** 33 fichiers d'écran, plus `src/test/pastilles-raisons.ts`.

C'est le volume du lot. Chaque badge devient un `TagChip` **sans `onClick`** —
donc rendu en `<span>`, ce que son contrat impose.

- [ ] **Step 1 : traiter par zone, dans cet ordre**

`activites` (13) · `voyages` (8) · `vins` (6) · `places` (4) · `famille` (5) ·
`compte` (4) · le reste (4). Une zone par commit : un diff de 44 remplacements
est irrelisible, et une erreur de ton s'y noierait.

Pour chaque site, choisir le ton d'après ce que le badge DIT, pas d'après la
couleur qu'il porte aujourd'hui :

- un état de réussite ou de validité → `succes`
- une alerte, une échéance, une vacance → `alerte`
- une erreur, une expiration dépassée → `danger`
- une information neutre → `defaut`
- ce qui appartient à l'utilisateur → `actif-doux`

**Si la couleur actuelle contredit le sens, suivre le sens et le dire dans le
rapport.** Une teinte posée par habitude n'est pas une décision.

- [ ] **Step 2 : les trois compteurs vont à `CountBadge`, pas à `TagChip`**

`NavItem`, et les deux badges « premium ». `CountBadge` a déjà ses trois tons.

- [ ] **Step 3 : la dette descend à zéro**

Retirer chaque entrée `dette:` au fur et à mesure, et abaisser `PLAFOND_DETTE`
à **0** au dernier commit de la tâche. C'est le moment où le second garde-fou
prend enfin tout son sens.

- [ ] **Step 4 : vérification complète**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
npm run test:e2e
```

---

### Task 4 : le coup d'œil, et ce qui reste

- [ ] **Step 1 : le PO regarde, dans les deux thèmes**

Les badges changent d'apparence partout : leur libellé n'est plus coloré. À
regarder en particulier là où plusieurs badges de tons différents se côtoient —
la semaine des Activités, la liste des voyages, la fiche d'un vin.

- [ ] **Step 2 : signaler ce que le lot laisse**

Après la tâche 3, la dette est à zéro mais **52 pastilles restent** dans le
dépôt, toutes avec une raison définitive : boutons d'action, liens de
navigation, contrôles de formulaire, déclencheurs de menu, et le kit lui-même.
C'est le résultat honnête du chantier, et il contredit la prémisse du spec.

---

## Ce que ce plan ne fait pas

- Il ne touche pas aux **jetons** du lot 0. Le contraste est corrigé en changeant
  la couleur du TEXTE, pas les teintes — qui servent ailleurs (tuiles de
  statistiques, marqueurs de carte) et y passent déjà leurs seuils.
- Il ne migre **aucun** bouton d'action, lien, contrôle de formulaire ou
  déclencheur : leurs raisons sont définitives depuis 6B-2.
- Il ne construit ni `StatusToggle` ni `PlaceMapMarker` — lot 6C, avec le
  passage du favori de l'étoile or au cœur accent.
