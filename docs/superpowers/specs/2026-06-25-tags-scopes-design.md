# Slice 1 (épic places) — Tags scopés + couleur — Design

**Date :** 2026-06-25
**Statut :** Validé (décisions épic). Plan à suivre.
**Branche :** `tags-scopes`

---

## 0. Contexte

Première slice de l'épic « Restos + Hôtels » (cf. `docs/design/places-epic-directive.md`). Prépare le
**scope de tags** nécessaire aux deux catégories : un tag est `common` (resto **et** hôtel),
`restaurant` (resto seulement) ou `hotel` (hôtel seulement) ; et porte une **couleur** optionnelle. La
table `tags` actuelle (`slug, label, categorie='ambiance', is_system`) n'a ni scope ni couleur.

## 1. Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Scope | Colonne `scope` ∈ `{common, restaurant, hotel}` (text + CHECK), défaut `common`. |
| Couleur | Colonne `color text` nullable (hex, ex. `#4ADE80`). |
| Tags existants | Les 6 tags système d'ambiance passent `scope='common'` (applicables aux deux). |
| Nouveaux tags | Seedés **en migration** (comme 00004, pour exister en prod) : quelques `restaurant` + `hotel`, avec couleur. |
| Compat | `getTags()` (utilisé par l'écran **Goûts**) **n'est pas modifié** ; on ajoute une requête scope-aware dédiée. |
| `categorie` | Colonne legacy conservée telle quelle (non utilisée comme scope). |

## 2. Migration `supabase/migrations/00017_tag_scopes.sql`

```sql
alter table public.tags
  add column scope text not null default 'common' check (scope in ('common','restaurant','hotel')),
  add column color text;

-- Les tags d'ambiance existants s'appliquent aux deux catégories
update public.tags set scope = 'common' where is_system = true;

-- Couleurs sur les tags common existants (optionnel, lisible)
update public.tags set color = '#60A5FA' where slug in ('en_amoureux','entre_amis','avec_vue','en_famille','business','terrasse');

-- Nouveaux tags système scopés (idempotent), avec couleur
insert into public.tags (slug, label, categorie, is_system, scope, color) values
  ('gastronomique', 'Gastronomique', 'cuisine', true, 'restaurant', '#C084FC'),
  ('cuisine_marche', 'Cuisine du marché', 'cuisine', true, 'restaurant', '#4ADE80'),
  ('cave_a_vins', 'Cave à vins', 'cuisine', true, 'restaurant', '#FBBF24'),
  ('spa', 'Spa', 'equipement', true, 'hotel', '#C084FC'),
  ('piscine', 'Piscine', 'equipement', true, 'hotel', '#60A5FA'),
  ('petit_dej_inclus', 'Petit-déjeuner inclus', 'equipement', true, 'hotel', '#4ADE80'),
  ('vue_mer', 'Vue mer', 'ambiance', true, 'common', '#60A5FA')
on conflict (slug) do nothing;
```
RLS inchangée (tags = SELECT authentifié, écriture système). Migration additive → aucune donnée
utilisateur touchée. Idempotente.

## 3. Données / requêtes (`src/features/restos/data/queries.ts`)

- **Ne pas modifier `getTags()`** (toujours `select id, slug, label order label` — utilisé par Goûts).
- Ajouter `getTagsForCategory(category: "restaurant" | "hotel")` → `select id, slug, label, color`
  where `scope = 'common' or scope = category`, ordonné par label. (RLS SELECT existante.)

## 4. UI (`src/features/restos/ui/TagPicker.tsx` + fiche)

- `TagPicker` reçoit des tags `{ id, slug, label, color }` et rend des **pastilles colorées** (la
  couleur sur le badge/checkbox ; fallback neutre si `color` nul). Conserver `data-testid="tags-saved"`,
  l'action `setTags`, le comportement (cases à cocher → enregistrement).
- `FicheResto` (resto) passe désormais les tags via `getTagsForCategory("restaurant")` (common +
  restaurant) au lieu de `getTags()`. (Les hôtels utiliseront `"hotel"` en slice ultérieure.)
- `setTags` (liaison `liste_item_tags`) inchangé.

## 5. Sécurité

- Migration additive, RLS inchangée. Pas d'action/donnée utilisateur modifiée. Tags = référentiel
  système (lecture).

## 6. Tests

- **Migration** : `db reset` applique 00001→00017 ; vérifier colonnes `scope`/`color` + comptes de tags
  par scope (≥1 restaurant, ≥1 hotel, common = anciens + vue_mer).
- **e2e non-régression** : `restos.spec.ts` (notamment `tags-saved`) reste **vert sans modification** —
  la fiche resto montre désormais common+restaurant (sur-ensemble incluant les tags existants), donc le
  parcours de tag fonctionne toujours. Build/typecheck/lint verts (types régénérés).
- Pas de nouveau test unitaire requis (requête simple) ; un test léger de `getTagsForCategory` est
  bienvenu si trivial.

## 7. Arbitrages / dette

- Création de tags **par l'utilisateur** (is_system=false) + UI de gestion : différée (hors slice).
- Le scope « affiné » (ex. terrasse = restaurant plutôt que common) : ajustable plus tard ; on reste
  large (common) par défaut.
