# Chantier 3 — Recherche & Recommandation — Design

**Date :** 2026-06-21
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-3-recherche-reco`

---

## 0. Contexte

Troisième chantier de Vito. Onboarding des goûts + moteur de recherche/recommandation, branché
sur Restos (Chantier 1) et les signaux existants. On respecte l'architecture en place :
`features/<module>/{domain,data,ui}`, RLS partout + grants explicites, types dérivés du schéma,
TDD sur la logique métier, e2e sur le parcours. Diagnostic-first, un slice vertical testé.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Source des recos complémentaires | **Pool interne** (table `etablissements` partagée) scoré/filtré de façon déterministe ; **« élargir avec Places »** derrière l'abstraction `PlacesProvider` existante, **différé/désactivé** sans clé (zéro coût). |
| Profil de goût | **Onboarding explicite** (`profil_gouts`) **+ affinage implicite** dérivé à la volée des favoris/tags et des notes d'avis. |
| LLM | **Aucun** dans ce chantier : scoring déterministe, transparent, testable. Abstraction LLM différée. |

## 2. Limite de modélisation assumée (ambiance)

Chantier 1 a fait des tags d'ambiance des **annotations personnelles** (sur le `liste_item` de
l'utilisateur), pas des attributs objectifs de l'établissement. Conséquence :
- **« Ta liste d'abord »** : le filtre ambiance fonctionne pleinement (tags perso de l'utilisateur).
- **Recos complémentaires** (pool partagé) : filtrage par **critères objectifs uniquement** —
  zone (`arrondissement`/`ville`), budget (`price_level`), type (`étoilé`/`bistrot`…) + score de goût.
  Le filtrage par ambiance (terrasse/vue) sur le pool sera débloqué quand les établissements auront
  des attributs d'ambiance **objectifs** (via la classification Places/LLM différée).

## 3. Modèle de données (`supabase/migrations/00008_profil_gouts.sql`)

```sql
create table public.profil_gouts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ambiances text[] not null default '{}',        -- slugs de tags préférés
  budget_max numeric(10, 2) check (budget_max is null or budget_max >= 0),
  types_preferes text[] not null default '{}',   -- étoilé/bistrot/brasserie…
  zones text[] not null default '{}',            -- arrondissements/villes préférés
  updated_at timestamptz not null default now()
);

alter table public.profil_gouts enable row level security;
create policy "profil_gouts_all_owner" on public.profil_gouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.profil_gouts to authenticated;
```
Le **signal implicite** n'est pas stocké : dérivé à la volée à la recherche depuis les `liste_items`
favoris (leurs tags) et les `avis` bien notés (types de leurs établissements).

## 4. Onboarding / « Mes goûts »

- `(app)/gouts/page.tsx` : formulaire éditable (ambiances multi-select depuis `tags`, budget cible,
  types préférés, zones) → action `saveGouts` (Zod, upsert owner sur `profil_gouts`).
- Au premier login sans ligne `profil_gouts`, redirection douce vers l'onboarding (depuis le layout
  `(app)` ou la home authentifiée — vérification légère, non bloquante).
- `error.tsx` sur le segment.

## 5. Recherche + moteur de reco

- `(app)/recherche/page.tsx` : critères **zone / budget / ambiance / type** (form, query params).
- `data/queries.ts` → `rechercheRestos(criteria)` renvoie deux blocs :
  1. **Ta liste d'abord** : `liste_items` (de l'utilisateur) joints à `etablissements` correspondant
     aux critères, ambiance incluse via les tags perso.
  2. **Recos complémentaires (~10)** : `etablissements` partagés **absents de la liste de l'utilisateur**,
     filtrés par critères **objectifs** (zone, `price_level`/budget, type), puis triés par
     `scoreEtablissement(etab, gouts, signauxImplicites)`.
- `domain/scoring.ts` → `scoreEtablissement(...)` **pure** : recouvrement `types_preferes`, `zones`,
  proximité budget, bonus signaux implicites. Déterministe, testée.
- `domain/implicit.ts` → `buildSignauxImplicites(favoris, avisNotes)` **pure** : agrège les types/zones
  récurrents des favoris et avis bien notés en un petit vecteur de préférence.
- Bouton **« élargir avec Places »** : `getPlacesProvider().search(...)` (mock en dev, réel si clé) —
  candidats frais par critères, fusionnés/dédoublonnés avec le pool. Désactivé proprement sans clé.

## 6. Sécurité

- `profil_gouts` : RLS owner-only + grants explicites (dès la migration).
- La reco lit `etablissements` (déjà SELECT authentifié — **donnée de référence**, pas personnelle →
  aucune fuite) et les `liste_items`/`avis` **de l'utilisateur** (RLS owner). On recommande des
  **établissements**, jamais « tel utilisateur a aimé X » → pas de fuite de données perso.
- `user_id` toujours dérivé de la session ; validation Zod avant écriture ; pas de client service-role
  dans la couche données.

## 7. i18n

Namespaces `gouts.*` et `recherche.*` dans `messages/fr.json` (libellés critères, types, zones,
boutons, sections « Ta liste » / « Recommandations », vide, erreurs). Aucune chaîne en dur.

## 8. Tests & seed

- **Unit (Vitest, TDD)** : `scoreEtablissement`, `buildSignauxImplicites`, schémas Zod
  (`goutsInputSchema`, `rechercheCriteriaSchema`), mapping critères→requête.
- **Seed dev** : +4–5 établissements démo variés (type/zone/`price_level`), dont **1 seul** dans la
  liste du client → la recherche montre « ta liste » (1) + complémentaires (les autres). 1 ligne
  `profil_gouts` démo pour le client. UUID v4 valides.
- **e2e (Playwright)** : régler ses goûts → rechercher par zone/type → « ta liste d'abord » affichée +
  recos complémentaires affichées (≥1). Provider Places mock (pas de clé requise).
- CI : démarre déjà Supabase + applique migrations/seed ; les nouveaux e2e tournent en CI.

## 9. Arbitrages / dette signalés

- **Ambiance sur le pool partagé** : recos complémentaires limitées aux critères objectifs tant que
  les établissements n'ont pas d'attributs d'ambiance objectifs (classification Places/LLM différée).
- **Démarrage à froid** : qualité des recos limitée par la taille du pool au début ; « élargir avec
  Places » différé (clé/coût).
- **Profil implicite dérivé à la volée** (pas de vecteur stocké, pas de job batch) — acceptable à
  cette échelle ; à revisiter si la dérivation devient coûteuse.
- **LLM différé** : pas de génération/ranking LLM ce chantier ; scoring déterministe.
