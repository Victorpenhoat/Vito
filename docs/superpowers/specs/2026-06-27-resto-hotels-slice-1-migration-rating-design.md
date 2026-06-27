# Slice 1 (épic Resto+Hôtels) — Migration 00020 + enrichissement rating — Design

**Date :** 2026-06-27
**Statut :** Validé (PO). Plan ensuite.
**Branche :** `restos-hotels-refonte` (porte aussi le setup d'épic : directive + 3 maquettes)
**Directive :** `docs/design/restos-hotels-refonte-epic-directive.md`

---

## 0. Contexte

Fondation data de l'épic. Ajoute les colonnes nécessaires aux slices suivantes (sans écran) :
`reco_source` + `is_archived`/`archived_at` (sur `liste_items`), `rating` + `rating_count` (sur
`etablissements`), et **remplit `rating` depuis Google** à l'enrichissement (chaîne
`PlaceResult.rating` → `mapPlaceToEtablissement` → `upsert_etablissement`). Aucun affichage encore
(le rating s'affiche en Slice 2, `reco_source`/`is_archived` en Slices 3/6).

## 1. Migration `supabase/migrations/00020_resto_rating_archive.sql`

```sql
-- liste_items : source de reco + archivage (orthogonaux au statut/favori)
alter table public.liste_items add column if not exists reco_source text;
alter table public.liste_items add column if not exists is_archived boolean not null default false;
alter table public.liste_items add column if not exists archived_at timestamptz;

-- etablissements : note Google stockée à l'enrichissement
alter table public.etablissements add column if not exists rating numeric(2,1)
  check (rating is null or (rating >= 0 and rating <= 5));
alter table public.etablissements add column if not exists rating_count integer
  check (rating_count is null or rating_count >= 0);
```

Puis **`create or replace function public.upsert_etablissement(p jsonb)`** = copie EXACTE de la version
00018 (photo) + ajout de `rating`/`rating_count` :
- déclarer `v_rating numeric(2,1) := nullif(p ->> 'rating','')::numeric;` et
  `v_rating_count integer := nullif(p ->> 'rating_count','')::integer;` ;
- ajouter `rating`, `rating_count` à la liste de colonnes de l'`insert` + aux `values` (`v_rating`,
  `v_rating_count`) ;
- dans le `on conflict do update set` : `rating = coalesce(excluded.rating, public.etablissements.rating)`
  et `rating_count = coalesce(excluded.rating_count, public.etablissements.rating_count)` (garde
  l'ancienne note si la nouvelle est nulle, comme `photo_ref`).
- `security definer`, `set search_path = ''`, grants inchangés (le `create or replace` les conserve).

RLS inchangée. Régénérer `src/types/database.types.ts`.

## 2. Provider Places — `rating`

- **`src/lib/services/places/types.ts`** : ajouter à `PlaceResult` :
  `rating: number | null;` et `ratingCount: number | null;`.
- **`GooglePlacesProvider.details()`** : remplir `rating` depuis le champ Google `rating` (0-5) et
  `ratingCount` depuis `userRatingCount` (API v1) / `user_ratings_total` (legacy) — `null` si absent.
- **`MockPlacesProvider`** : ajouter `rating`/`ratingCount` déterministes aux résultats mock (ex. resto
  `rating: 4.6, ratingCount: 320` ; hôtel `rating: 4.5, ratingCount: 210`). Mettre à jour le test mock.

## 3. Mapping — `src/features/restos/domain/mapPlaceToEtablissement.ts`

- `EtablissementInput` : ajouter `rating: number | null;` et `rating_count: number | null;`.
- `mapPlaceToEtablissement(p, categorie)` : `rating: p.rating`, `rating_count: p.ratingCount`.
- (Les actions qui appellent `upsert_etablissement` passent déjà `{ ...input, enriched_at }` →
  `rating`/`rating_count` transitent automatiquement. Vérifier `addPlace` (restos) et
  `ajouterRestoRecherche` (famille) : aucun changement si elles spreadent l'input complet.)

## 4. Sécurité

- Migration **additive** (aucune donnée touchée). `is_archived`/`reco_source` sur `liste_items`
  (déjà RLS owner-only sur les 4 verbes) → modifiables uniquement par le propriétaire. `etablissements`
  lecture authentifiée (le rating est public/partagé, comme nom/photo). `upsert_etablissement` reste
  `security definer` avec garde `auth.uid()`. Google mocké en test ; clé server-only.

## 5. Tests

- **Unit** : `mapPlaceToEtablissement` inclut `rating`/`rating_count` (depuis `PlaceResult`) ;
  `MockPlacesProvider.details` renvoie un `rating` numérique 0-5 + `ratingCount`.
- **Migration** : `supabase db reset` applique 00001→00020 ; vérifier les colonnes
  `liste_items.reco_source/is_archived/archived_at` + `etablissements.rating/rating_count` + la
  contrainte `rating between 0 and 5`. (psql/docker.)
- **e2e non-régression** : l'ajout d'un resto via la recherche (mock) fonctionne toujours (le rating est
  stocké mais pas encore affiché) ; suite e2e existante verte. Build OK.

## 6. Prod

- Migration 00020 **additive** → appliquée sur Resto_Hotels **avant le merge** (autorisation PO au
  « go prod » de la slice), comme 00017/00018/00019. Types régénérés.

## 7. Arbitrages / dette

- `reco_source`/`is_archived`/`archived_at` posés ici mais **exploités plus tard** (Slices 3/6) — pas de
  bouton mort, juste le schéma. `rating` rempli ici, **affiché** en Slice 2.
- `numeric(2,1)` borne 0.0-5.0 (1 décimale) — suffisant pour ★ /5 et score ×2 /10.
- Pas de rafraîchissement périodique du rating (re-enrichissement seulement à l'upsert) — dette notée
  (acceptable : le carnet n'a pas besoin de notes temps réel).
