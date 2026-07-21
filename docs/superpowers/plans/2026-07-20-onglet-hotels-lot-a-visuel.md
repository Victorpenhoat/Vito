# Lot A — Polish visuel onglet Hôtels (+ Restos partagé) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner l'onglet Favoris (mobile + web) des pages Hôtels et Restos sur les maquettes `docs/design/Onglet_Hotels.dc.html` / `Onglet_Resto.dc.html` : vue Liste compacte, état vide riche, header (eyebrow + titre + h1 web).

**Architecture:** Composants partagés restos+hôtels (`PageHeader`, `PlaceCard`, `PlaceListPanel`, `PlacesTabs`). On fait évoluer le composant partagé avec des libellés paramétrés par catégorie via i18n + `categoryConfig`. Aucun fork. UI + i18n uniquement, **aucune migration DB, aucune server action**.

**Tech Stack:** Next.js (App Router, RSC), React client components, next-intl (4 locales `fr/en/es/it`), Tailwind (tokens kit), Vitest + Testing Library, Playwright (e2e, exécuté en CI).

## Global Constraints

- **Migration-free** : aucun changement de schéma DB, aucune server action, aucune donnée nouvelle.
- **Classe étoiles hôtel (★★★★) : hors périmètre** (décision PO Slice 7 — `categoryConfig.hotel.showStarClass` reste `false`, pas de source de données). La ligne Liste hôtel n'affiche PAS d'étoiles de classe.
- **4 locales** : toute clé i18n ajoutée/modifiée doit l'être dans `messages/fr.json`, `en.json`, `es.json`, `it.json` — sinon clé manquante à l'exécution.
- **`data-testid` préservés** (`place-card`, `place-card-vignette`, `place-note`, `place-reco`, `places-panel`, tabs…) pour ne pas casser les e2e.
- **e2e non exécutable en local** (Docker/Supabase down) → les specs Playwright sont validées par la CI (job `quality`). En local : `npm run lint`, `npm run typecheck`, `npm run test` (vitest).
- **Titres conformes maquette** : `hotels.title` = « Hôtels », `restos.title` = « Restaurants ».
- Branche de travail : `feat/hotels-lot-a-visuel` (déjà créée).

---

### Task 1 : Header — eyebrow « Mon carnet », titres maquette, h1 web responsive

**Files:**
- Modify: `src/features/shared/ui/PageHeader.tsx:20`
- Modify: `src/app/[locale]/(app)/hotels/page.tsx:12`
- Modify: `src/app/[locale]/(app)/restos/page.tsx` (ligne `<PageHeader title={t("title")} />`)
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json`, `messages/it.json`

**Interfaces:**
- Consumes: `PageHeader({ title, eyebrow?, subtitle?, action? })` (existant, inchangé).
- Produces: clés i18n `hotels.eyebrow`, `restos.eyebrow` ; valeurs modifiées `hotels.title`, `restos.title`.

- [ ] **Step 1: i18n — modifier titres + ajouter eyebrow dans les 4 locales**

Dans chaque fichier `messages/<loc>.json`, sous l'objet `hotels`, remplacer la valeur `title` et ajouter `eyebrow` ; idem sous `restos`. Valeurs exactes :

| Locale | `hotels.title` | `hotels.eyebrow` | `restos.title` | `restos.eyebrow` |
|---|---|---|---|---|
| fr | `Hôtels` | `Mon carnet` | `Restaurants` | `Mon carnet` |
| en | `Hotels` | `My journal` | `Restaurants` | `My journal` |
| es | `Hoteles` | `Mi cuaderno` | `Restaurantes` | `Mi cuaderno` |
| it | `Hotel` | `Il mio taccuino` | `Ristoranti` | `Il mio taccuino` |

Exemple pour `messages/fr.json` (objet `hotels`) :

```json
"hotels": { "title": "Hôtels", "eyebrow": "Mon carnet", "error": { "title": "Une erreur est survenue", "retry": "Réessayer" } },
```

- [ ] **Step 2: PageHeader — h1 responsive (30px mobile → ~38px web)**

`src/features/shared/ui/PageHeader.tsx:20`, remplacer :

```tsx
        <h1 className="font-serif text-3xl font-medium text-ink">{title}</h1>
```

par :

```tsx
        <h1 className="font-serif text-3xl font-medium text-ink lg:text-4xl">{title}</h1>
```

- [ ] **Step 3: Pages — passer l'eyebrow**

`src/app/[locale]/(app)/hotels/page.tsx`, remplacer `<PageHeader title={t("title")} />` par :

```tsx
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
```

Faire le même remplacement dans `src/app/[locale]/(app)/restos/page.tsx`.

- [ ] **Step 4: Vérifier compilation + lint + tests unitaires**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (aucun test n'assert les anciens titres « Mes hôtels »/« Mes restos » — vérifié).

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/ui/PageHeader.tsx "src/app/[locale]/(app)/hotels/page.tsx" "src/app/[locale]/(app)/restos/page.tsx" messages/
git commit -m "feat(hotels): header maquette — eyebrow Mon carnet + titres + h1 web responsive"
```

---

### Task 2 : Label note personnelle « / ma note » (au lieu de « /10 »)

**Files:**
- Modify: `src/features/places/ui/PlaceCard.tsx:37`
- Modify: `src/features/places/ui/PlaceCard.test.tsx:7,44,37`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json`, `messages/it.json`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: clé i18n `places.noteMaNote` (remplace `places.noteSur10`).

- [ ] **Step 1: Adapter le test (rouge d'abord)**

`src/features/places/ui/PlaceCard.test.tsx` — remplacer la clé du mock (ligne 7) :

```tsx
const messages = { places: { noteMaNote: "/ ma note", "conseilléPar": "Conseillé par {name}" } };
```

Remplacer l'assertion resto (ligne ~37) :

```tsx
    expect(note).not.toHaveTextContent("/ ma note");
```

Remplacer le bloc hôtel (ligne ~40-45) :

```tsx
  it("hôtel : affiche le score /10 (= rating × 2) avec le label « / ma note »", () => {
    renderCard(makePlace({ categorie: "hotel", rating: 4.5 }));
    const note = screen.getByTestId("place-note");
    expect(note).toHaveTextContent("9,0");
    expect(note).toHaveTextContent("/ ma note");
  });
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx`
Expected: FAIL (le composant utilise encore `noteSur10`, absent du mock → texte vide, `/ ma note` introuvable).

- [ ] **Step 3: Implémenter — PlaceCard utilise la nouvelle clé**

`src/features/places/ui/PlaceCard.tsx:37`, remplacer :

```tsx
          <span className="text-muted">{t("noteSur10")}</span>
```

par :

```tsx
          <span className="text-muted">{t("noteMaNote")}</span>
```

- [ ] **Step 4: i18n — renommer la clé dans les 4 locales**

Dans chaque `messages/<loc>.json`, sous `places`, remplacer la paire `"noteSur10": "/10"` par :

| Locale | `places.noteMaNote` |
|---|---|
| fr | `/ ma note` |
| en | `/ my rating` |
| es | `/ mi nota` |
| it | `/ il mio voto` |

- [ ] **Step 5: Lancer le test → passe**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx`
Expected: PASS

- [ ] **Step 6: Vérif globale + Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/features/places/ui/PlaceCard.tsx src/features/places/ui/PlaceCard.test.tsx messages/
git commit -m "feat(places): label note personnelle « / ma note » (remplace /10)"
```

---

### Task 3 : Vue Liste compacte — lignes horizontales à miniature 72px

**Files:**
- Modify: `src/features/places/ui/PlaceCard.tsx:92-126` (variant `liste`)
- Modify: `src/features/places/ui/PlaceListPanel.tsx:34-37` (conteneur liste)
- Modify: `src/features/places/ui/PlaceCard.test.tsx` (ajout d'un test)

**Interfaces:**
- Consumes: `PlaceCard({ place, variant })` (inchangé). Variables déjà définies dans le composant : `note`, `chips`, `reco`, `subtitle`, `photoUrl`, `initial`, `is_favorite`, `base`, `etablissement`.
- Produces: nouveau `data-testid="place-card-liste"` sur la racine `Link` du variant liste (symétrie avec `place-card-vignette`).

- [ ] **Step 1: Écrire le test (rouge d'abord)**

Dans `src/features/places/ui/PlaceCard.test.tsx`, ajouter au `describe("PlaceCard — variants & chips", …)` :

```tsx
  it("liste : racine liste présente, favori et miniature rendus", () => {
    renderCard(makePlace({ nom: "Le Bistrot Démo", ville: "Paris" }, tags));
    expect(screen.getByTestId("place-card-liste")).toBeInTheDocument();
    expect(screen.queryByTestId("place-card-vignette")).toBeNull();
    // sous-titre (type · ville) rendu à droite de la miniature
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx -t "racine liste présente"`
Expected: FAIL (`place-card-liste` n'existe pas encore).

- [ ] **Step 3: Réécrire le variant liste en ligne horizontale**

`src/features/places/ui/PlaceCard.tsx`, remplacer tout le bloc `return (…)` final (lignes 92-126, celui SANS `variant === "vignette"`) par :

```tsx
  return (
    <li data-testid="place-card">
      <Link
        href={`/${base}/${etablissement.id}`}
        data-testid="place-card-liste"
        className="flex gap-3 py-3.5"
      >
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-card bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={etablissement.nom} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-2xl text-faint">{initial}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-serif text-lg font-medium leading-tight text-ink">{etablissement.nom}</span>
            {is_favorite && (
              <span aria-label="favori" className="shrink-0 text-base text-gold">★</span>
            )}
          </div>
          {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
          {reco}
          {(note || chips) && (
            <div className="mt-1 flex items-center gap-2">
              {note}
              {note && chips && <span className="text-line">·</span>}
              {chips}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
```

- [ ] **Step 4: Conteneur liste → lignes empilées avec séparateurs**

`src/features/places/ui/PlaceListPanel.tsx:34-37`, remplacer :

```tsx
  const gridCls =
    view === "vignettes"
      ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      : "grid grid-cols-1 gap-5 sm:grid-cols-2";
```

par :

```tsx
  const gridCls =
    view === "liste"
      ? "divide-y divide-line"
      : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3";
```

- [ ] **Step 5: Lancer les tests PlaceCard → passent**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx`
Expected: PASS (le nouveau test + les tests chips/reco/note existants restent verts — le variant liste rend toujours `note`, `chips` (≤2), `reco`).

- [ ] **Step 6: Vérif globale + Commit**

Run: `npm run typecheck && npm run lint && npm run test`
```bash
git add src/features/places/ui/PlaceCard.tsx src/features/places/ui/PlaceListPanel.tsx src/features/places/ui/PlaceCard.test.tsx
git commit -m "feat(places): vue Liste compacte — lignes horizontales miniature 72px"
```

---

### Task 4 : État vide riche (icône + titre serif + texte + CTA)

**Files:**
- Create: `src/features/places/ui/PlaceEmptyState.tsx`
- Create: `src/features/places/ui/PlaceEmptyState.test.tsx`
- Modify: `src/features/places/ui/PlaceListPanel.tsx` (props + rendu vide)
- Modify: `src/features/places/ui/PlacesTabs.tsx:64-65` (câblage `emptyKind` + `onDiscover`)
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json`, `messages/it.json`

**Interfaces:**
- Consumes: `categoryConfig` (catégorie), tokens kit, next-intl `useTranslations("places")`.
- Produces:
  - `PlaceEmptyState({ category: "resto" | "hotel"; kind: "favoris" | "recommandes"; onDiscover: () => void })`.
  - `PlaceListPanel` gagne deux props : `emptyKind: "favoris" | "recommandes"` et `onDiscover: () => void`.
  - Clés i18n : `places.emptyFavorisTitle`, `places.emptyFavorisBody`, `places.emptyRecommandesTitle`, `places.emptyRecommandesBody`, `places.emptyCtaHotel`, `places.emptyCtaResto`.

- [ ] **Step 1: i18n — ajouter les clés d'état vide dans les 4 locales (retirer `empty`)**

Dans chaque `messages/<loc>.json`, sous `places`, SUPPRIMER la clé `"empty"` (devenue inutilisée) et AJOUTER :

| Clé | fr | en | es | it |
|---|---|---|---|---|
| `emptyFavorisTitle` | `Aucun favori pour l'instant` | `No favourites yet` | `Aún no hay favoritos` | `Ancora nessun preferito` |
| `emptyFavorisBody` | `Ajoute tes coups de cœur pour les retrouver d'un coup d'œil, même hors connexion.` | `Add your favourites to find them at a glance, even offline.` | `Añade tus favoritos para encontrarlos de un vistazo, incluso sin conexión.` | `Aggiungi i tuoi preferiti per ritrovarli a colpo d'occhio, anche offline.` |
| `emptyRecommandesTitle` | `Rien à tester pour l'instant` | `Nothing to try yet` | `Nada que probar por ahora` | `Niente da provare per ora` |
| `emptyRecommandesBody` | `Quand on te conseille une adresse, ajoute-la ici pour ne pas l'oublier.` | `When someone recommends a place, add it here so you don't forget.` | `Cuando te recomienden un sitio, añádelo aquí para no olvidarlo.` | `Quando ti consigliano un posto, aggiungilo qui per non dimenticarlo.` |
| `emptyCtaHotel` | `Découvrir des hôtels` | `Discover hotels` | `Descubrir hoteles` | `Scopri hotel` |
| `emptyCtaResto` | `Découvrir des restos` | `Discover restaurants` | `Descubrir restaurantes` | `Scopri ristoranti` |

- [ ] **Step 2: Écrire le test du composant (rouge d'abord)**

Create `src/features/places/ui/PlaceEmptyState.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { PlaceEmptyState } from "./PlaceEmptyState";

const messages = {
  places: {
    emptyFavorisTitle: "Aucun favori pour l'instant",
    emptyFavorisBody: "Ajoute tes coups de cœur…",
    emptyRecommandesTitle: "Rien à tester pour l'instant",
    emptyRecommandesBody: "Quand on te conseille une adresse…",
    emptyCtaHotel: "Découvrir des hôtels",
    emptyCtaResto: "Découvrir des restos",
  },
};

const renderState = (props: Parameters<typeof PlaceEmptyState>[0]) =>
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <PlaceEmptyState {...props} />
    </NextIntlClientProvider>,
  );

describe("PlaceEmptyState", () => {
  it("favoris hôtel : titre favoris + CTA hôtel", () => {
    renderState({ category: "hotel", kind: "favoris", onDiscover: () => {} });
    expect(screen.getByText("Aucun favori pour l'instant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Découvrir des hôtels" })).toBeInTheDocument();
  });

  it("recommandes resto : titre recommandés + CTA resto", () => {
    renderState({ category: "resto", kind: "recommandes", onDiscover: () => {} });
    expect(screen.getByText("Rien à tester pour l'instant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Découvrir des restos" })).toBeInTheDocument();
  });

  it("clic CTA → appelle onDiscover", async () => {
    const onDiscover = vi.fn();
    renderState({ category: "hotel", kind: "favoris", onDiscover });
    await userEvent.click(screen.getByRole("button", { name: "Découvrir des hôtels" }));
    expect(onDiscover).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Lancer le test → échoue**

Run: `npx vitest run src/features/places/ui/PlaceEmptyState.test.tsx`
Expected: FAIL ("Failed to resolve import ./PlaceEmptyState").

- [ ] **Step 4: Créer le composant**

Create `src/features/places/ui/PlaceEmptyState.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";

const ICON = {
  hotel: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-4 7 4v13" />
      <path d="M9 21v-5h6v5" />
      <path d="M9 11h.01M15 11h.01" />
    </>
  ),
  resto: (
    <>
      <path d="M4 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M6 3v18" />
      <path d="M16 3c-1.5 0-3 1.5-3 5s1.5 4 3 4v6" />
    </>
  ),
};

export function PlaceEmptyState({
  category,
  kind,
  onDiscover,
}: {
  category: "resto" | "hotel";
  kind: "favoris" | "recommandes";
  onDiscover: () => void;
}) {
  const t = useTranslations("places");
  const title = kind === "favoris" ? t("emptyFavorisTitle") : t("emptyRecommandesTitle");
  const body = kind === "favoris" ? t("emptyFavorisBody") : t("emptyRecommandesBody");
  const cta = category === "hotel" ? t("emptyCtaHotel") : t("emptyCtaResto");

  return (
    <div
      data-testid="place-empty-state"
      className="flex flex-col items-center justify-center px-10 py-12 text-center"
    >
      <span className="mb-5 grid h-[92px] w-[92px] place-items-center rounded-full border border-line bg-sidebar text-faint">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICON[category]}
        </svg>
      </span>
      <h2 className="font-serif text-2xl font-medium text-ink">{title}</h2>
      <p className="mt-2.5 mb-6 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
      <button
        type="button"
        onClick={onDiscover}
        className="rounded-control bg-accent px-5 py-3 text-sm font-semibold text-white"
      >
        {cta}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Lancer le test → passe**

Run: `npx vitest run src/features/places/ui/PlaceEmptyState.test.tsx`
Expected: PASS

- [ ] **Step 6: Câbler dans PlaceListPanel**

`src/features/places/ui/PlaceListPanel.tsx` — ajouter l'import (après la ligne 8 `import { PlaceCard } …`) :

```tsx
import { PlaceEmptyState } from "./PlaceEmptyState";
```

Étendre la signature des props (bloc lignes 16-26) pour ajouter `emptyKind` et `onDiscover` :

```tsx
export function PlaceListPanel({
  places,
  views,
  locale,
  category,
  emptyKind,
  onDiscover,
}: {
  places: Place[];
  views: PlaceView[];
  locale: string;
  category: "resto" | "hotel";
  emptyKind: "favoris" | "recommandes";
  onDiscover: () => void;
}) {
```

Remplacer la branche vide (ligne 100) :

```tsx
        <p className="text-sm text-muted">{t("empty")}</p>
```

par :

```tsx
        <PlaceEmptyState category={category} kind={emptyKind} onDiscover={onDiscover} />
```

- [ ] **Step 7: Câbler dans PlacesTabs**

`src/features/places/ui/PlacesTabs.tsx:64-65`, remplacer :

```tsx
          {tab === "favoris" && <PlaceListPanel places={favoris} views={TAB_VIEWS.favoris} locale={locale} category={category} />}
          {tab === "recommandes" && <PlaceListPanel places={recommandes} views={TAB_VIEWS.recommandes} locale={locale} category={category} />}
```

par :

```tsx
          {tab === "favoris" && <PlaceListPanel places={favoris} views={TAB_VIEWS.favoris} locale={locale} category={category} emptyKind="favoris" onDiscover={() => setTab("recherche")} />}
          {tab === "recommandes" && <PlaceListPanel places={recommandes} views={TAB_VIEWS.recommandes} locale={locale} category={category} emptyKind="recommandes" onDiscover={() => setTab("recherche")} />}
```

- [ ] **Step 8: Vérif globale + Commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (typecheck valide les nouvelles props obligatoires ; les deux seuls appels de `PlaceListPanel` sont dans `PlacesTabs`, mis à jour).

```bash
git add src/features/places/ui/PlaceEmptyState.tsx src/features/places/ui/PlaceEmptyState.test.tsx src/features/places/ui/PlaceListPanel.tsx src/features/places/ui/PlacesTabs.tsx messages/
git commit -m "feat(places): état vide riche (icône + titre + CTA Découvrir) par catégorie/onglet"
```

---

## Vérification finale (après les 4 tasks)

- [ ] **Suite complète locale**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS

- [ ] **Pousser + PR (la CI exécute e2e)**

```bash
git push -u origin feat/hotels-lot-a-visuel
gh pr create --fill
```
Expected: CI verte (job `quality` = typecheck + lint + vitest + RLS + e2e). Vérifier `gh pr checks` avant merge.

- [ ] **Vérification visuelle** (si l'app est lançable) : `/fr/hotels` et `/fr/restos` — header (eyebrow + titre), onglet Favoris vue Liste (lignes 72px), bascule Vignettes intacte, état vide (compte sans favori) avec CTA qui bascule sur Recherche.

## Notes de couverture (self-review)

- **Spec §Section 1 (header)** → Task 1. **§Section 2 (état vide)** → Task 4. **§Section 3 (vue Liste)** → Task 3. **Note « / ma note »** (spec §Section 3) → Task 2 (isolée car testable/rejetable indépendamment).
- **Hors lot** (FAB, carte flottante, cœur bleu, filtre sliders, compteur, skeleton lignes, classe étoiles) : non traités, conformément à la spec.
- **`PageHeader.stories.tsx`** garde `title: "Mes restos"` (story illustrative, hors périmètre) — non bloquant.
- **Types cohérents** : `emptyKind`/`onDiscover` définis en Task 4 et consommés uniquement par les 2 appels dans `PlacesTabs` (mêmes noms). `place-card-liste` (Task 3) réutilisé par aucune autre task. `noteMaNote` (Task 2) consommé seulement par `PlaceCard`.
