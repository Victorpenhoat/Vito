# Slice 1 — Tags scopés + couleur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux tags un `scope` (common/restaurant/hotel) + une couleur, pour préparer le tagging resto ET hôtel — sans casser l'usage actuel des tags (écran Goûts).

**Architecture:** Migration additive sur `tags` (scope + color) + tags système scopés seedés en migration ; une requête `getTagsForCategory` scope-aware (sans toucher `getTags()`) ; `TagPicker` rend des pastilles colorées ; `FicheResto` passe les tags resto en `restaurant`.

**Tech Stack:** Supabase (migration + RLS), Next.js 16, next-intl, Playwright.

## Global Constraints

- Migration **additive** (pas de donnée utilisateur touchée), idempotente. RLS inchangée.
- **Ne pas modifier `getTags()`** (utilisé par l'écran Goûts) — ajouter une requête dédiée.
- Conserver `data-testid="tags-saved"`, l'action `setTags`, le comportement du `TagPicker`. L'e2e restos
  doit rester vert sans modification.
- Prochaine migration = **00017**.
- Gate par task indiqué.

---

### Task 1: Migration 00017 (scope + color + tags système)

**Files:**
- Create: `supabase/migrations/00017_tag_scopes.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00017_tag_scopes.sql` exactly as the spec §2 (alter add `scope` text+CHECK
default 'common' + `color` text ; update existing system tags → scope 'common' + colors ; idempotent
insert of the new restaurant/hotel/common scoped tags with colors).

- [ ] **Step 2: Appliquer + vérifier**

Run: `supabase db reset`
Then verify:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select scope, count(*) from public.tags group by scope order by scope;
select column_name from information_schema.columns where table_name='tags' and column_name in ('scope','color');
"
```
Expected: 00001→00017 appliquées ; colonnes `scope`+`color` présentes ; au moins 1 `restaurant`, 1 `hotel`,
et `common` ≥ 7 (6 anciens + vue_mer). (Si `psql` absent : `docker exec -i supabase_db_Vito psql -U postgres -d postgres -c "..."`.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00017_tag_scopes.sql
git commit -m "feat(tags): scope (common/restaurant/hotel) + couleur + tags système scopés (00017)"
```

---

### Task 2: Requête scope-aware + TagPicker couleur + fiche resto

**Files:**
- Modify: `src/features/restos/data/queries.ts` (ajout `getTagsForCategory`)
- Modify: `src/features/restos/ui/TagPicker.tsx` (pastilles colorées)
- Modify: `src/features/restos/ui/FicheResto.tsx` (passe `getTagsForCategory("restaurant")`)
- Modify: `src/types/database.types.ts` (régénéré)

**Interfaces:**
- Produces : `getTagsForCategory(category: "restaurant" | "hotel"): Promise<{ id; slug; label; color: string | null }[]>`.

- [ ] **Step 1: Régénérer les types (nouvelles colonnes)**

Run: `supabase gen types typescript --local > src/types/database.types.ts 2>/dev/null`
(Si la sortie est polluée par un avis de mise à jour CLI, relancer avec `2>/dev/null` ; vérifier que
`tags` a bien `scope`/`color`.)

- [ ] **Step 2: `getTagsForCategory` (sans toucher `getTags()`)**

In `src/features/restos/data/queries.ts`, ADD (do not modify the existing `getTags`):
```ts
export async function getTagsForCategory(category: "restaurant" | "hotel") {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tags")
    .select("id, slug, label, color")
    .or(`scope.eq.common,scope.eq.${category}`)
    .order("label");
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 3: `TagPicker` — pastilles colorées**

In `src/features/restos/ui/TagPicker.tsx`, accept tags carrying an optional `color` and render a colored
pill/dot per tag (e.g. a small `<span>` with `style={{ backgroundColor: color }}` when `color` is set,
neutral fallback otherwise). PRESERVE: `data-testid="tags-saved"`, the `setTags` action, the
checkbox/selection logic, i18n. Only the visual rendering of each tag gains color; the prop type widens
to include `color: string | null`.

- [ ] **Step 4: `FicheResto` passe la catégorie**

In `src/features/restos/ui/FicheResto.tsx`, replace the tags source from `getTags()` to
`getTagsForCategory("restaurant")` (import it). The TagPicker now receives common+restaurant tags with
colors. Nothing else changes (the existing `getTags()` import elsewhere — e.g. the Goûts page — stays).

- [ ] **Step 5: Vérifier (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 6: e2e restos (non-régression)**

Run: `supabase db reset && npx playwright test e2e/restos.spec.ts --retries=0`
Expected: PASS sans modifier le spec (le parcours `tags-saved` fonctionne : la fiche montre désormais
common+restaurant, sur-ensemble des tags existants). Retry une fois si le webServer échoue à démarrer.

- [ ] **Step 7: Commit**

```bash
git add src/features/restos/data/queries.ts src/features/restos/ui/TagPicker.tsx src/features/restos/ui/FicheResto.tsx src/types/database.types.ts
git commit -m "feat(tags): TagPicker scope-aware + couleurs (fiche resto = common+restaurant)"
```

---

### Task 3: Non-régression — suite complète

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète verte + build OK. Si un spec échoue, corriger le composant (testid/flux), pas le
test. Un seul `db reset` avant.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(tags): correctifs non-régression" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (migration) → T2 (requête+UI) → T3 (non-régression).
- **Prod** : migration 00017 à appliquer sur Resto_Hotels au moment du « go prod » (après merge), comme
  les chantiers précédents.
- `getTags()` intact (Goûts) ; seul l'ajout `getTagsForCategory` + le rendu couleur changent.
