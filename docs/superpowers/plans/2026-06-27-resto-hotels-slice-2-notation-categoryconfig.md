# Slice 2 — Brique notation + categoryConfig + variant vignette — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher la note (★/5 resto, score/10 hôtel) sur les cartes de lieux via un domaine pur `categoryConfig`, et rendre `PlaceCard` en deux variants (liste et vignette).

**Architecture:** Domaine pur `categoryConfig` (calcul de la notation + limite de chips par variant), consommé par `PlaceCard` (composant client) qui formate les nombres via next-intl. La donnée `rating` est remontée par `getPlaces()` depuis `etablissements`. Aucune migration (00020 déjà en prod).

**Tech Stack:** Next 16 (App Router), React, TypeScript, next-intl 4, Supabase, Vitest (jsdom + @testing-library/react), Playwright.

Spec de référence : `docs/superpowers/specs/2026-06-27-resto-hotels-slice-2-notation-categoryconfig-design.md`.

## Global Constraints

- Mobile-first PWA, App Router Next 16. `Link`/`redirect` **locale-aware** via `@/lib/i18n/routing` (jamais `next/link`).
- i18n **4 locales** `fr, en, it, es` en **parité** (toute clé ajoutée dans les 4). Aucune chaîne en dur.
- **Aucun nouveau token** de design. Tokens maison uniquement (`--accent`, `text-gold`, `rounded-card`, `rounded-control`, `bg-surface`, `border-line`, `text-ink`, `text-muted`, `text-faint`). Aucune couleur du kit (`#2563EB`) en dur.
- **Aucune migration DB, aucun go-prod DB** dans cette slice.
- Note hôtel = `rating × 2`, libellé `/10` (une seule source Google ; pas de notation perso).
- Note resto = `rating`, échelle `/5`, glyphe `★`.
- `rating == null` → note **masquée** (pas de placeholder).
- Chips = `tags` existants. Liste : ≤ **2** chips ; vignette : **1** chip.
- TDD pour le domaine ; composant testé via Vitest + RTL ; écran via Playwright.

---

### Task 1: Remontée du `rating` dans la couche data + type `Place`

Plomberie : exposer `rating`/`rating_count` jusqu'à l'UI. Pas de nouveau comportement testable unitairement (la query tape Supabase) → vérifié par le typecheck et la suite existante restée verte.

**Files:**
- Modify: `src/features/places/domain/filterPlaces.ts:5` (type `Place.etablissement`)
- Modify: `src/features/places/data/queries.ts:9` (colonnes du `select`)
- Modify: `src/features/places/domain/filterPlaces.test.ts:8` (fabrique `P`)
- Modify: `src/features/places/domain/mapCenter.test.ts:7` (fabrique `place`)
- Modify: `src/features/restos/domain/splitSearch.test.ts:9` (fabrique `place`)

**Interfaces:**
- Consumes: rien (point de départ de la slice).
- Produces: `Place.etablissement` porte désormais `rating: number | null` et `rating_count: number | null`, peuplés par `getPlaces()`.

- [ ] **Step 1: Étendre le type `Place.etablissement`**

Dans `src/features/places/domain/filterPlaces.ts`, remplacer la ligne 5 :

```ts
  etablissement: { id: string; nom: string; type: string | null; ville: string | null; arrondissement: string | null; categorie: "resto" | "hotel"; photo_ref: string | null; lat: number | null; lng: number | null; place_id: string | null; rating: number | null; rating_count: number | null };
```

- [ ] **Step 2: Remonter les colonnes dans `getPlaces()`**

Dans `src/features/places/data/queries.ts`, remplacer le `select` (ligne 8-10) par :

```ts
    .select(
      "id, statut, is_favorite, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref, lat, lng, place_id, rating, rating_count), tags:liste_item_tags(tag:tags(slug, label, color))"
    )
```

(Le mapping `etablissement: Array.isArray(...) ? row.etablissement[0]! : row.etablissement` reste inchangé : les nouvelles colonnes passent automatiquement.)

- [ ] **Step 3: Mettre à jour les 3 fabriques de test**

Le type étant plus strict, les littéraux `etablissement` des fabriques ne compilent plus. Ajouter `rating: null, rating_count: null` dans chacun.

`src/features/places/domain/filterPlaces.test.ts` (ligne ~8) — la propriété `etablissement` devient :

```ts
  etablissement: { id: nom, nom, type: null, ville, arrondissement: null, categorie: "resto" as const, photo_ref: null, lat: null, lng: null, place_id: null, rating: null, rating_count: null },
```

`src/features/places/domain/mapCenter.test.ts` (ligne ~7) :

```ts
  etablissement: { id: "x", nom: "X", type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat, lng, place_id: null, rating: null, rating_count: null },
```

`src/features/restos/domain/splitSearch.test.ts` (ligne ~9) :

```ts
  etablissement: { id: "e", nom: over.nom, type: null, ville: null, arrondissement: null, categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: over.place_id ?? null, rating: null, rating_count: null },
```

- [ ] **Step 4: Typecheck + suite verte**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. Aucune erreur de type ; tous les tests existants verts.

- [ ] **Step 5: Commit**

```bash
git add src/features/places/domain/filterPlaces.ts src/features/places/data/queries.ts src/features/places/domain/filterPlaces.test.ts src/features/places/domain/mapCenter.test.ts src/features/restos/domain/splitSearch.test.ts
git commit -m "feat(places): remonter rating/rating_count jusqu'au type Place + getPlaces"
```

---

### Task 2: Domaine pur `categoryConfig`

Calcul de la notation par catégorie et limite de chips par variant. 100 % pur, TDD.

**Files:**
- Create: `src/features/places/domain/categoryConfig.ts`
- Test: `src/features/places/domain/categoryConfig.test.ts`

**Interfaces:**
- Consumes: rien (pur).
- Produces (signatures exactes utilisées par Task 3) :
  - `type Categorie = "resto" | "hotel"`
  - `type Notation = { kind: "stars"; value: number; scale: 5 } | { kind: "score"; value: number; scale: 10 }`
  - `computeNotation(categorie: Categorie, rating: number | null): Notation | null`
  - `chipsForVariant<T>(tags: T[], categorie: Categorie, variant: "liste" | "vignette"): T[]`
  - `categoryConfig: Record<Categorie, CategoryConfig>` avec `CategoryConfig = { notationKind: "stars" | "score"; maxChipsListe: number; maxChipsVignette: number; descriptor: "cuisine" | "ambiance"; showStarClass: boolean }`

- [ ] **Step 1: Écrire le test (échouant)**

Créer `src/features/places/domain/categoryConfig.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { computeNotation, chipsForVariant, categoryConfig } from "./categoryConfig";

describe("computeNotation", () => {
  it("resto → étoiles /5 avec la valeur brute", () => {
    expect(computeNotation("resto", 4.6)).toEqual({ kind: "stars", value: 4.6, scale: 5 });
  });
  it("hôtel → score /10 = rating × 2", () => {
    expect(computeNotation("hotel", 4.5)).toEqual({ kind: "score", value: 9, scale: 10 });
    expect(computeNotation("hotel", 5)).toEqual({ kind: "score", value: 10, scale: 10 });
  });
  it("rating null → null (resto et hôtel)", () => {
    expect(computeNotation("resto", null)).toBeNull();
    expect(computeNotation("hotel", null)).toBeNull();
  });
  it("rating 0 → note rendue (valeur 0), pas null", () => {
    expect(computeNotation("resto", 0)).toEqual({ kind: "stars", value: 0, scale: 5 });
    expect(computeNotation("hotel", 0)).toEqual({ kind: "score", value: 0, scale: 10 });
  });
});

describe("chipsForVariant", () => {
  const tags = ["a", "b", "c"];
  it("liste → max 2", () => expect(chipsForVariant(tags, "resto", "liste")).toEqual(["a", "b"]));
  it("vignette → max 1", () => expect(chipsForVariant(tags, "resto", "vignette")).toEqual(["a"]));
  it("moins de tags que le max → tous", () => expect(chipsForVariant(["a"], "hotel", "liste")).toEqual(["a"]));
});

describe("categoryConfig", () => {
  it("resto = étoiles + descripteur cuisine, classe étoiles non rendue", () => {
    expect(categoryConfig.resto.notationKind).toBe("stars");
    expect(categoryConfig.resto.descriptor).toBe("cuisine");
    expect(categoryConfig.resto.showStarClass).toBe(false);
  });
  it("hôtel = score + descripteur ambiance, classe étoiles non rendue (→ Slice 7)", () => {
    expect(categoryConfig.hotel.notationKind).toBe("score");
    expect(categoryConfig.hotel.descriptor).toBe("ambiance");
    expect(categoryConfig.hotel.showStarClass).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npx vitest run src/features/places/domain/categoryConfig.test.ts`
Expected: FAIL — `Failed to resolve import "./categoryConfig"`.

- [ ] **Step 3: Implémenter `categoryConfig.ts`**

Créer `src/features/places/domain/categoryConfig.ts` :

```ts
export type Categorie = "resto" | "hotel";

export type Notation =
  | { kind: "stars"; value: number; scale: 5 }
  | { kind: "score"; value: number; scale: 10 };

/** Note d'affichage. resto = étoiles /5 (valeur brute) ; hôtel = score /10 (= rating × 2). null si pas de rating. */
export function computeNotation(categorie: Categorie, rating: number | null): Notation | null {
  if (rating == null) return null;
  if (categorie === "hotel") return { kind: "score", value: rating * 2, scale: 10 };
  return { kind: "stars", value: rating, scale: 5 };
}

export type CategoryConfig = {
  notationKind: "stars" | "score";
  maxChipsListe: number;
  maxChipsVignette: number;
  /** Descripteur secondaire (chips), source = tags. */
  descriptor: "cuisine" | "ambiance";
  /** Réservé Slice 7 : classe étoiles hôtel. Non rendu ni alimenté en Slice 2. */
  showStarClass: boolean;
};

export const categoryConfig: Record<Categorie, CategoryConfig> = {
  resto: { notationKind: "stars", maxChipsListe: 2, maxChipsVignette: 1, descriptor: "cuisine", showStarClass: false },
  hotel: { notationKind: "score", maxChipsListe: 2, maxChipsVignette: 1, descriptor: "ambiance", showStarClass: false },
};

/** Limite la liste de chips selon la catégorie et le variant. */
export function chipsForVariant<T>(tags: T[], categorie: Categorie, variant: "liste" | "vignette"): T[] {
  const cfg = categoryConfig[categorie];
  const max = variant === "vignette" ? cfg.maxChipsVignette : cfg.maxChipsListe;
  return tags.slice(0, max);
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run src/features/places/domain/categoryConfig.test.ts`
Expected: PASS (toutes les assertions).

- [ ] **Step 5: Commit**

```bash
git add src/features/places/domain/categoryConfig.ts src/features/places/domain/categoryConfig.test.ts
git commit -m "feat(places): domaine pur categoryConfig (computeNotation + chipsForVariant)"
```

---

### Task 3: `PlaceCard` étendu (variant + note + chips limités) + i18n

Le composant consomme `categoryConfig`, formate les nombres via next-intl, et rend deux variants. Devient client (hooks). Test composant via Vitest + RTL.

**Files:**
- Modify: `src/features/places/ui/PlaceCard.tsx`
- Create: `src/features/places/ui/PlaceCard.test.tsx`
- Modify: `messages/fr.json` (namespace `places`)
- Modify: `messages/en.json` (namespace `places`)
- Modify: `messages/it.json` (namespace `places`)
- Modify: `messages/es.json` (namespace `places`)

**Interfaces:**
- Consumes: `computeNotation`, `chipsForVariant` de `../domain/categoryConfig` ; `Place.etablissement.rating` (Task 1).
- Produces: `PlaceCard` accepte `variant?: "liste" | "vignette"` (défaut `"liste"`). Émet `data-testid="place-note"` quand une note est affichée, et `data-testid="place-card-vignette"` sur la racine en variant vignette.

- [ ] **Step 1: Ajouter la clé i18n `noteSur10` aux 4 locales**

Dans le namespace `places` de chaque fichier, ajouter la clé après `"vueCarte"` (parité des 4 locales — même valeur symbolique `/10`).

`messages/fr.json` :

```json
    "vueCarte": "Carte",
    "noteSur10": "/10",
```

Idem dans `messages/en.json`, `messages/it.json`, `messages/es.json` (chacun garde ses autres clés ; on ajoute seulement `"noteSur10": "/10",` juste après leur clé `"vueCarte"`).

- [ ] **Step 2: Écrire le test composant (échouant)**

Créer `src/features/places/ui/PlaceCard.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PlaceCard } from "./PlaceCard";
import type { Place } from "../domain/filterPlaces";

const messages = { places: { noteSur10: "/10" } };

const makePlace = (over: Partial<Place["etablissement"]> = {}, tags: Place["tags"] = []): Place => ({
  id: "li1",
  statut: "a_faire",
  is_favorite: false,
  etablissement: {
    id: "e1", nom: "Le Bistrot Démo", type: null, ville: "Paris", arrondissement: null,
    categorie: "resto", photo_ref: null, lat: null, lng: null, place_id: null,
    rating: 4.6, rating_count: 320, ...over,
  },
  tags,
});

const renderCard = (place: Place, variant?: "liste" | "vignette") =>
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ul>
        <PlaceCard place={place} variant={variant} />
      </ul>
    </NextIntlClientProvider>
  );

describe("PlaceCard — note", () => {
  it("resto : affiche l'étoile et la note /5 formatée (virgule fr)", () => {
    renderCard(makePlace({ categorie: "resto", rating: 4.6 }));
    const note = screen.getByTestId("place-note");
    expect(note).toHaveTextContent("★");
    expect(note).toHaveTextContent("4,6");
    expect(note).not.toHaveTextContent("/10");
  });

  it("hôtel : affiche le score /10 (= rating × 2) formaté", () => {
    renderCard(makePlace({ categorie: "hotel", rating: 4.5 }));
    const note = screen.getByTestId("place-note");
    expect(note).toHaveTextContent("9,0");
    expect(note).toHaveTextContent("/10");
  });

  it("rating null : aucune note rendue", () => {
    renderCard(makePlace({ rating: null }));
    expect(screen.queryByTestId("place-note")).toBeNull();
  });
});

describe("PlaceCard — variants & chips", () => {
  const tags: Place["tags"] = [
    { slug: "a", label: "Bistrot", color: null },
    { slug: "b", label: "Classique", color: null },
    { slug: "c", label: "Terrasse", color: null },
  ];

  it("liste (défaut) : au plus 2 chips, pas de racine vignette", () => {
    renderCard(makePlace({}, tags));
    expect(screen.getByText("Bistrot")).toBeInTheDocument();
    expect(screen.getByText("Classique")).toBeInTheDocument();
    expect(screen.queryByText("Terrasse")).toBeNull();
    expect(screen.queryByTestId("place-card-vignette")).toBeNull();
  });

  it("vignette : 1 seul chip et racine vignette présente", () => {
    renderCard(makePlace({}, tags), "vignette");
    expect(screen.getByText("Bistrot")).toBeInTheDocument();
    expect(screen.queryByText("Classique")).toBeNull();
    expect(screen.getByTestId("place-card-vignette")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Lancer le test → échec**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx`
Expected: FAIL — `place-note`/`place-card-vignette` introuvables et/ou prop `variant` inconnue.

- [ ] **Step 4: Réécrire `PlaceCard.tsx`**

Remplacer **tout** le contenu de `src/features/places/ui/PlaceCard.tsx` par :

```tsx
"use client";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Badge } from "@/features/shared/ui/Badge";
import type { Place } from "../domain/filterPlaces";
import { computeNotation, chipsForVariant } from "../domain/categoryConfig";

type Variant = "liste" | "vignette";

export function PlaceCard({ place, variant = "liste" }: { place: Place; variant?: Variant }) {
  const { etablissement, tags, is_favorite } = place;
  const t = useTranslations("places");
  const format = useFormatter();
  const base = etablissement.categorie === "hotel" ? "hotels" : "restos";
  const subtitle = [etablissement.type, etablissement.ville].filter(Boolean).join(" · ");
  const photoUrl = etablissement.photo_ref
    ? `/api/places/photo?ref=${encodeURIComponent(etablissement.photo_ref)}&w=800`
    : null;
  const initial = etablissement.nom.charAt(0).toUpperCase();

  const notation = computeNotation(etablissement.categorie, etablissement.rating);
  const visibleTags = chipsForVariant(tags, etablissement.categorie, variant);
  const fmt = (v: number) => format.number(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const note = notation && (
    <span data-testid="place-note" className="inline-flex items-center gap-1 text-sm text-ink">
      {notation.kind === "stars" ? (
        <>
          <span className="text-gold">★</span>
          {fmt(notation.value)}
        </>
      ) : (
        <>
          <span className="font-semibold">{fmt(notation.value)}</span>
          <span className="text-muted">{t("noteSur10")}</span>
        </>
      )}
    </span>
  );

  const chips = visibleTags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map((tag) => (
        <Badge key={tag.slug} style={tag.color ? { backgroundColor: tag.color } : undefined} className={tag.color ? "text-white" : ""}>
          {tag.label}
        </Badge>
      ))}
    </div>
  );

  if (variant === "vignette") {
    return (
      <li data-testid="place-card">
        <Link
          href={`/${base}/${etablissement.id}`}
          data-testid="place-card-vignette"
          className="block overflow-hidden rounded-card border border-line bg-surface"
        >
          <div className="relative h-26 bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={etablissement.nom} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-serif text-3xl text-faint">{initial}</span>
            )}
            {is_favorite && (
              <span aria-label="favori" className="absolute right-2 top-2 text-base text-gold drop-shadow">★</span>
            )}
          </div>
          <div className="flex flex-col gap-1 p-3">
            <span className="font-serif text-base font-medium text-ink">{etablissement.nom}</span>
            {etablissement.ville && <span className="text-xs text-muted">{etablissement.ville}</span>}
            <div className="mt-1 flex items-center justify-between gap-2">
              {note}
              {chips}
            </div>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <li data-testid="place-card">
      <Link
        href={`/${base}/${etablissement.id}`}
        className="block overflow-hidden rounded-card border border-line bg-surface"
      >
        <div className="relative h-40 bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={etablissement.nom} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-4xl text-faint">{initial}</span>
          )}
          {is_favorite && (
            <span aria-label="favori" className="absolute right-3 top-3 text-lg text-gold drop-shadow">★</span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-4">
          {etablissement.type && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{etablissement.type}</span>
          )}
          <span className="font-serif text-xl font-medium text-ink">{etablissement.nom}</span>
          {subtitle && <span className="text-sm text-muted">{etablissement.ville}</span>}
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
}
```

- [ ] **Step 5: Lancer le test → succès**

Run: `npx vitest run src/features/places/ui/PlaceCard.test.tsx`
Expected: PASS (note resto/hôtel, null masqué, chips liste ≤ 2, vignette = 1 chip + racine vignette).

- [ ] **Step 6: Typecheck + suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. (`PlacesTabs` appelle `<PlaceCard place={...} />` sans `variant` → défaut `"liste"`, inchangé.)

- [ ] **Step 7: Commit**

```bash
git add src/features/places/ui/PlaceCard.tsx src/features/places/ui/PlaceCard.test.tsx messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): PlaceCard variants liste/vignette + note par catégorie (categoryConfig)"
```

---

### Task 4: e2e — la note s'affiche sur la liste resto

Doter le resto seedé d'un `rating` et vérifier la note rendue sur l'écran resto réel.

**Files:**
- Modify: `supabase/seed.sql:46-48` (insert « Le Bistrot Démo »)
- Modify: `e2e/places.spec.ts`

**Interfaces:**
- Consumes: `PlaceCard` variant liste (Task 3), `getPlaces` remontant `rating` (Task 1).
- Produces: rien (test terminal).

- [ ] **Step 1: Ajouter `rating` au seed du Bistrot Démo**

Dans `supabase/seed.sql`, remplacer l'insert lignes 46-48 par (ajout de la colonne `rating` et de sa valeur `4.6`) :

```sql
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source, photo_ref, photo_fetched_at, rating)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed', 'mock_photo_1', now(), 4.6);
```

- [ ] **Step 2: Réappliquer le seed local**

Run: `npx supabase db reset`
Expected: la base locale se recharge sans erreur (seed inclus).

- [ ] **Step 3: Ajouter le test e2e**

Dans `e2e/places.spec.ts`, ajouter à la fin du fichier :

```ts
test("la note du resto s'affiche sur la liste (★ 4,6)", async ({ page }) => {
  await login(page);
  const card = page.getByTestId("place-card").first();
  await expect(card.getByTestId("place-note")).toBeVisible();
  await expect(card.getByTestId("place-note")).toContainText("4,6");
});
```

- [ ] **Step 4: Lancer l'e2e places**

Run: `npx playwright test e2e/places.spec.ts`
Expected: PASS (les 7 tests existants + le nouveau).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql e2e/places.spec.ts
git commit -m "test(places): e2e note affichée sur la liste resto + rating seed"
```

---

## Self-Review

**Spec coverage :**
- §1 Data (remontée rating) → Task 1. ✅
- §2 Domaine `categoryConfig` (computeNotation, config 2 catégories, emplacement classe étoiles réservé) → Task 2. ✅
- §3 UI `PlaceCard` (variant, note par catégorie, formatage next-intl, chips limités, tokens maison) → Task 3. ✅
- §4 i18n (`noteSur10`, parité 4 locales) → Task 3 Step 1. ✅
- §Tests (domaine TDD, composant, e2e) → Tasks 2, 3, 4. ✅
- §Sécurité (lecture seule, pas de migration/RLS) → respecté (aucune écriture, aucune migration). ✅
- Hors périmètre (toggle Slice 3, classe étoiles/UI hôtel Slice 7) → non implémenté ; `showStarClass:false` réservé. ✅

**Placeholder scan :** aucun TBD/TODO ; tout le code est fourni intégralement.

**Type consistency :** `computeNotation`/`chipsForVariant`/`categoryConfig` (Task 2) sont consommés avec les mêmes signatures dans `PlaceCard` (Task 3). `Place.etablissement.rating: number | null` (Task 1) est utilisé tel quel par `computeNotation`. Prop `variant?: "liste" | "vignette"` cohérente entre composant, test et `chipsForVariant`. `data-testid` (`place-note`, `place-card-vignette`, `place-card`) cohérents entre composant, test composant et e2e.

**Gap connu (assumé) :** le rendu JSX du variant **vignette** est couvert par le test composant (Task 3) mais pas encore par un e2e — aucun écran ne le monte avant la Slice 3 (toggle de vue). À couvrir en e2e à ce moment-là.
