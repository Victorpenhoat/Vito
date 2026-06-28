# Slice 6 — Archivage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archiver/désarchiver un établissement (`is_archived`) : exclu des listes actives, consultable via une vue « Archivés » discrète d'où on le désarchive.

**Architecture:** `getArchivedPlaces` (sibling de `getPlaces`) + `is_archived` sur `getFiche`. Action `toggleArchive` + schéma (calque `toggleFavorite`). `ArchiveToggle` sur la fiche ; `ArchivedPanel` (liste + désarchiver inline) ; lien discret « Archivés (N) » dans `PlacesTabs`.

**Tech Stack:** Next 16 (App Router), React, TypeScript, next-intl 4, Supabase (RLS owner-only), Tailwind v4, Vitest, Playwright.

Spec : `docs/superpowers/specs/2026-06-28-resto-hotels-slice-6-archivage-design.md`.

## Global Constraints

- Archiver **orthogonal** : ne touche ni `is_favorite` ni `statut` ; seulement masqué des listes actives. `archived_at` = now à l'archivage, null au désarchivage.
- Vue Archivés = **lien discret `tab-archives` « Archivés (N) »** sous la barre d'onglets, affiché si `N>0`. Les 4 onglets restent primaires.
- Archivage depuis la **fiche** ; désarchivage **inline** dans la liste Archivés (et aussi via le toggle fiche).
- RLS owner-only sur `liste_items` (inchangée). `toggleArchive` mute par `id`.
- i18n **4 locales** parité : `archiver`/`desarchiver` (namespace `restos`), `archives`/`archivesVide` (namespace `places`). Aucune chaîne en dur, aucun nouveau token.
- **Vérif pré-push** : `npm run lint && npx tsc --noEmit && npm test` (la CI `quality` lance eslint).
- **Aucune migration / pas de go-prod DB** (colonnes 00020 déjà en prod).

---

### Task 1: Data — `getArchivedPlaces` + `is_archived` sur `getFiche`

Factoriser la requête `places` et exposer les archivés ; remonter `is_archived` sur la fiche. Plomberie (pas de test unitaire — requêtes Supabase), vérifiée par tsc + suite.

**Files:**
- Modify: `src/features/places/data/queries.ts`
- Modify: `src/features/restos/data/queries.ts:7`

**Interfaces:**
- Consumes: rien.
- Produces: `getPlaces(category)` (inchangé) + `getArchivedPlaces(category): Promise<Place[]>` ; `getFiche().item` porte désormais `is_archived: boolean`.

- [ ] **Step 1: Réécrire `places/data/queries.ts`**

Remplacer **tout** le contenu de `src/features/places/data/queries.ts` par :

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Place } from "../domain/filterPlaces";

const SELECT =
  "id, statut, is_favorite, reco_source, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie, photo_ref, lat, lng, place_id, rating, rating_count), tags:liste_item_tags(tag:tags(slug, label, color))";

async function queryPlaces(category: "resto" | "hotel", archived: boolean): Promise<Place[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("liste_items")
    .select(SELECT)
    .eq("etablissement.categorie", category)
    .eq("is_archived", archived)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    statut: row.statut,
    is_favorite: row.is_favorite,
    reco_source: row.reco_source,
    etablissement: Array.isArray(row.etablissement) ? row.etablissement[0]! : row.etablissement,
    tags: (row.tags ?? []).flatMap((t) => {
      const tag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
      return tag ? [tag] : [];
    }),
  })) as Place[];
}

export function getPlaces(category: "resto" | "hotel"): Promise<Place[]> {
  return queryPlaces(category, false);
}

export function getArchivedPlaces(category: "resto" | "hotel"): Promise<Place[]> {
  return queryPlaces(category, true);
}
```

- [ ] **Step 2: `getFiche` remonte `is_archived`**

Dans `src/features/restos/data/queries.ts`, ligne 7, remplacer le select du `liste_items` :

```ts
    supabase.from("liste_items").select("id, statut, is_favorite, is_archived").eq("etablissement_id", etablissementId).maybeSingle(),
```

- [ ] **Step 3: Typecheck + suite verte**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS (aucune régression ; comportement `getPlaces` inchangé).

- [ ] **Step 4: Commit**

```bash
git add src/features/places/data/queries.ts src/features/restos/data/queries.ts
git commit -m "feat(places): getArchivedPlaces + is_archived sur getFiche"
```

---

### Task 2: Schéma `toggleArchiveSchema` (TDD) + action `toggleArchive`

**Files:**
- Modify: `src/features/restos/domain/schemas.ts`
- Modify: `src/features/restos/domain/schemas.test.ts`
- Modify: `src/features/restos/data/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `revalidatePath` (déjà importés dans actions).
- Produces: `toggleArchiveSchema` ; `toggleArchive(_prev, formData{listeItemId, isArchived})`.

- [ ] **Step 1: Écrire le test du schéma (échouant)**

Dans `src/features/restos/domain/schemas.test.ts` : importer `toggleArchiveSchema` et ajouter un `describe`.

Remplacer la ligne d'import :
```ts
import { toggleFavoriteSchema, addAvisSchema } from "./schemas";
```
par :
```ts
import { toggleFavoriteSchema, addAvisSchema, toggleArchiveSchema } from "./schemas";
```
Ajouter à la fin du fichier :
```ts
describe("toggleArchiveSchema", () => {
  it('parse "true" -> true', () => {
    expect(toggleArchiveSchema.parse({ listeItemId: UUID, isArchived: "true" }).isArchived).toBe(true);
  });
  it('parse "false" -> false', () => {
    expect(toggleArchiveSchema.parse({ listeItemId: UUID, isArchived: "false" }).isArchived).toBe(false);
  });
  it("rejette un listeItemId non-uuid", () => {
    expect(toggleArchiveSchema.safeParse({ listeItemId: "x", isArchived: "true" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `npx vitest run src/features/restos/domain/schemas.test.ts`
Expected: FAIL — `toggleArchiveSchema` n'est pas exporté.

- [ ] **Step 3: Ajouter le schéma**

Dans `src/features/restos/domain/schemas.ts`, ajouter à la fin :
```ts
export const toggleArchiveSchema = z.object({
  listeItemId: z.string().uuid(),
  isArchived: z.enum(["true", "false"]).transform((v) => v === "true"),
});
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run src/features/restos/domain/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Ajouter l'action `toggleArchive`**

Dans `src/features/restos/data/actions.ts` :

Remplacer la ligne d'import des schémas :
```ts
import {
  addRestoSchema, addAvisSchema, setTagsSchema, toggleFavoriteSchema,
} from "../domain/schemas";
```
par :
```ts
import {
  addRestoSchema, addAvisSchema, setTagsSchema, toggleFavoriteSchema, toggleArchiveSchema,
} from "../domain/schemas";
```
Ajouter cette fonction (par ex. après `toggleFavorite`) :
```ts
export async function toggleArchive(_prev: unknown, formData: FormData) {
  const parsed = toggleArchiveSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    isArchived: formData.get("isArchived"),
  });
  if (!parsed.success) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase
    .from("liste_items")
    .update({
      is_archived: parsed.data.isArchived,
      archived_at: parsed.data.isArchived ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.listeItemId);
  if (error) return { error: "Mise à jour échouée" };
  revalidatePath("/restos");
  revalidatePath("/hotels");
  return {};
}
```

- [ ] **Step 6: Typecheck + suite complète**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/restos/domain/schemas.ts src/features/restos/domain/schemas.test.ts src/features/restos/data/actions.ts
git commit -m "feat(restos): action toggleArchive + toggleArchiveSchema (TDD)"
```

---

### Task 3: UI — ArchiveToggle (fiche) + ArchivedPanel + PlacesTabs + pages + i18n

Doit atterrir ensemble (dépendances de compilation : PlacesTabs prop `archived` ⇄ pages).

**Files:**
- Create: `src/features/restos/ui/ArchiveToggle.tsx`
- Modify: `src/features/restos/ui/FicheResto.tsx`
- Create: `src/features/places/ui/ArchivedPanel.tsx`
- Modify: `src/features/places/ui/PlacesTabs.tsx`
- Modify: `src/app/[locale]/(app)/restos/page.tsx`, `src/app/[locale]/(app)/hotels/page.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Consumes: `toggleArchive` (Task 2) ; `getArchivedPlaces` (Task 1) ; `item.is_archived` (Task 1) ; `Button`, `Link`, `useActionState`.
- Produces: testids `archive-toggle` (fiche), `tab-archives` + `archived-item` + `archive-unarchive` + `archives-empty` (vue Archivés).

- [ ] **Step 1: i18n — ajouts (4 locales)**

Namespace `restos` — ajouter `archiver`/`desarchiver` :
- fr : `"archiver": "Archiver", "desarchiver": "Désarchiver",`
- en : `"archiver": "Archive", "desarchiver": "Unarchive",`
- it : `"archiver": "Archivia", "desarchiver": "Rimuovi dall'archivio",`
- es : `"archiver": "Archivar", "desarchiver": "Desarchivar",`

Namespace `places` — ajouter `archives`/`archivesVide` :
- fr : `"archives": "Archivés", "archivesVide": "Aucun établissement archivé",`
- en : `"archives": "Archived", "archivesVide": "No archived places",`
- it : `"archives": "Archiviati", "archivesVide": "Nessun locale archiviato",`
- es : `"archives": "Archivados", "archivesVide": "Ningún sitio archivado",`

Garder le JSON valide.

- [ ] **Step 2: Créer `ArchiveToggle.tsx`**

Créer `src/features/restos/ui/ArchiveToggle.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toggleArchive } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

export function ArchiveToggle({ listeItemId, isArchived }: { listeItemId: string; isArchived: boolean }) {
  const t = useTranslations("restos");
  const [, action] = useActionState(toggleArchive, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <input type="hidden" name="isArchived" value={String(!isArchived)} />
      <Button type="submit" variant="ghost" data-testid="archive-toggle">
        {isArchived ? t("desarchiver") : t("archiver")}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Rendre `ArchiveToggle` dans `FicheResto`**

Dans `src/features/restos/ui/FicheResto.tsx` : ajouter l'import après `import { FavoriteToggle } from "./FavoriteToggle";` :
```tsx
import { ArchiveToggle } from "./ArchiveToggle";
```
Et juste après la ligne `{item && <FavoriteToggle listeItemId={item.id} isFavorite={item.is_favorite} />}`, ajouter :
```tsx
      {item && <ArchiveToggle listeItemId={item.id} isArchived={item.is_archived} />}
```

- [ ] **Step 4: Créer `ArchivedPanel.tsx`**

Créer `src/features/places/ui/ArchivedPanel.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";
import { toggleArchive } from "@/features/restos/data/actions";
import type { Place } from "../domain/filterPlaces";

export function ArchivedPanel({ places }: { places: Place[] }) {
  const t = useTranslations("places");
  const tr = useTranslations("restos");
  const [, action] = useActionState(toggleArchive, undefined);
  if (places.length === 0) {
    return <p data-testid="archives-empty" className="text-sm text-muted">{t("archivesVide")}</p>;
  }
  return (
    <ul className="flex flex-col">
      {places.map((p) => {
        const base = p.etablissement.categorie === "hotel" ? "hotels" : "restos";
        return (
          <li key={p.id} data-testid="archived-item" className="flex items-center justify-between gap-3 border-b border-line-soft py-3">
            <Link href={`/${base}/${p.etablissement.id}`} className="min-w-0 text-accent hover:underline">
              <span className="font-serif text-base text-ink">{p.etablissement.nom}</span>
              {p.etablissement.ville ? <span className="text-sm text-muted"> · {p.etablissement.ville}</span> : null}
            </Link>
            <form action={action}>
              <input type="hidden" name="listeItemId" value={p.id} />
              <input type="hidden" name="isArchived" value="false" />
              <Button type="submit" variant="ghost" data-testid="archive-unarchive">{tr("desarchiver")}</Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: `PlacesTabs` — lien discret + panneau Archivés**

Dans `src/features/places/ui/PlacesTabs.tsx` :

Ajouter l'import :
```tsx
import { ArchivedPanel } from "./ArchivedPanel";
```
Étendre la signature et l'état :
```tsx
export function PlacesTabs({ category, places, archived }: { category: "resto" | "hotel"; places: Place[]; archived: Place[] }) {
```
```tsx
  const [tab, setTab] = useState<PlacesTab | "archives">("favoris");
```
Juste après la `<div ... role="tablist">…</div>` (la barre des 4 onglets), ajouter le lien discret :
```tsx
      {archived.length > 0 && (
        <button
          type="button"
          data-testid="tab-archives"
          aria-selected={tab === "archives"}
          onClick={() => setTab("archives")}
          className={`self-start text-xs ${tab === "archives" ? "font-semibold text-ink" : "text-muted"}`}
        >
          {t("archives")} <span className="text-faint">({archived.length})</span>
        </button>
      )}
```
Ajouter le panneau parmi les rendus conditionnels (à côté des `tab === …`) :
```tsx
      {tab === "archives" && <ArchivedPanel places={archived} />}
```

- [ ] **Step 6: Pages — fetch + passe `archived`**

`src/app/[locale]/(app)/restos/page.tsx` : importer `getArchivedPlaces` depuis `@/features/places/data/queries`, ajouter `const archived = await getArchivedPlaces("resto");`, et passer `archived={archived}` à `<PlacesTabs ... />`.

`src/app/[locale]/(app)/hotels/page.tsx` : idem avec `"hotel"`.

(Import existant `import { getPlaces } from "@/features/places/data/queries";` → `import { getPlaces, getArchivedPlaces } from "@/features/places/data/queries";`.)

- [ ] **Step 7: Typecheck + suite complète**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: PASS. (Les tests existants restent verts ; e2e en Task 4.)

- [ ] **Step 8: Commit**

```bash
git add src/features/restos/ui/ArchiveToggle.tsx src/features/restos/ui/FicheResto.tsx src/features/places/ui/ArchivedPanel.tsx src/features/places/ui/PlacesTabs.tsx "src/app/[locale]/(app)/restos/page.tsx" "src/app/[locale]/(app)/hotels/page.tsx" messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(places): vue Archivés (lien discret + ArchivedPanel) + ArchiveToggle sur la fiche"
```

---

### Task 4: e2e — archivage round-trip + seed

**Files:**
- Modify: `supabase/seed.sql`
- Modify: `e2e/places.spec.ts`

**Interfaces:**
- Consumes: tout l'archivage (Tasks 1-3).
- Produces: rien (test terminal).

- [ ] **Step 1: Seed — un resto déjà archivé**

Dans `supabase/seed.sql`, après le bloc « Le Comptoir Démo » (les inserts du 2e resto), ajouter :
```sql
-- Resto déjà archivé (vue Archivés) — sans coords (n'affecte pas le comptage Carte)
insert into public.etablissements (id, place_id, categorie, type, nom, ville, code_postal, arrondissement, source)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'demo_place_archive', 'resto', 'bistrot', 'Le Resto Archivé Démo', 'Paris', '75002', '2e', 'seed');
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite, is_archived)
values ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'a_faire', false, true);
```

- [ ] **Step 2: Réappliquer le seed local**

Run: `npx supabase db reset`
Expected: rechargement sans erreur.

- [ ] **Step 3: Ajouter le test e2e (round-trip neutre en état)**

Dans `e2e/places.spec.ts`, ajouter à la fin :
```ts
test("archivage : vue Archivés + désarchiver inline + ré-archiver depuis la fiche", async ({ page }) => {
  await login(page);
  const archived = () => page.getByTestId("archived-item").filter({ hasText: "Le Resto Archivé Démo" });
  // Le lien Archivés est visible (≥1 archivé seedé)
  await expect(page.getByTestId("tab-archives")).toBeVisible();
  await page.getByTestId("tab-archives").click();
  await expect(archived()).toBeVisible();
  // Désarchiver inline → quitte la liste Archivés
  await archived().getByTestId("archive-unarchive").click();
  await expect(archived()).toHaveCount(0);
  // RESTAURER : ouvrir la fiche et ré-archiver
  await page.goto("/fr/restos/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  await page.getByTestId("archive-toggle").click();
  // De retour sur la liste, il est de nouveau archivé
  await page.goto("/fr/restos");
  await page.getByTestId("tab-archives").click();
  await expect(archived()).toBeVisible();
});
```

- [ ] **Step 4: Lancer l'e2e places**

Run: `npx playwright test e2e/places.spec.ts`
Expected: PASS (les tests existants + le nouveau). Le resto archivé seedé n'apparaît dans aucune liste active (exclu) → comptages inchangés.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql e2e/places.spec.ts
git commit -m "test(places): e2e archivage (vue Archivés + désarchiver/ré-archiver) + seed"
```

---

## Self-Review

**Spec coverage :**
- §1 Data (`getArchivedPlaces` + `getFiche` is_archived) → Task 1. ✅
- §2 Domaine (`toggleArchiveSchema`) → Task 2. ✅
- §3 Action (`toggleArchive`) → Task 2. ✅
- §4 UI (ArchiveToggle fiche, ArchivedPanel inline unarchive, PlacesTabs lien discret, pages) → Task 3. ✅
- §5 i18n (restos archiver/desarchiver, places archives/archivesVide, parité) → Task 3. ✅
- §Tests (schéma TDD, e2e round-trip neutre) → Tasks 2, 4. ✅
- §Sécurité (RLS owner-only, mute par id, orthogonal) → respecté. ✅
- Hors périmètre (masse, depuis cartes, statut visite) → non implémenté. ✅

**Placeholder scan :** aucun TBD/TODO ; code complet à chaque étape.

**Type consistency :** `toggleArchiveSchema`/`toggleArchive` (Task 2) consommés par ArchiveToggle/ArchivedPanel (Task 3) avec les mêmes champs (`listeItemId`, `isArchived` string). `getArchivedPlaces` (Task 1) → prop `archived: Place[]` de PlacesTabs (Task 3) → pages (Task 3). `item.is_archived` (Task 1) lu par FicheResto (Task 3). testids alignés UI ↔ e2e : `archive-toggle`, `tab-archives`, `archived-item`, `archive-unarchive`, `archives-empty`.

**Gap connu (assumé) :** le toggle fiche ne se rafraîchit pas in-place après clic (revalidatePath cible /restos+/hotels, pas la route fiche dynamique) — comportement **identique à `FavoriteToggle` existant**, accepté ; la mutation persiste en DB et la liste se met à jour. L'e2e navigue après le clic fiche, donc ne dépend pas du rafraîchissement in-place. `ArchivedPanel`/`ArchiveToggle` n'ont pas de test composant (server actions + jsdom) ; couverts par l'e2e (Task 4) ; logique de schéma testée en pur (Task 2). Le resto archivé seedé (sans coords) ne touche aucun comptage des tests existants (exclu des listes actives).
