# Chantier 5 — Comptes partagés (dépenses de groupe) — Design

**Date :** 2026-06-21
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-5-depenses`

---

## 0. Contexte

Cinquième chantier de Vito : module **Comptes partagés** — partage de dépenses entre membres
d'un groupe, calcul des soldes, suggestion de transferts minimaux et enregistrement des
remboursements. On réutilise le modèle multi-utilisateur de Voyages (C4) : owner + membres,
helpers `security definer` anti-récursion, partage par e-mail d'utilisateurs existants. On respecte
l'architecture en place : `features/<module>/{domain,data,ui}`, RLS partout + grants explicites,
types dérivés du schéma, TDD, e2e. Diagnostic-first, un slice vertical testé.

## 1. Nommage produit

Label UI : **« Comptes partagés »**. On **n'utilise pas « Tricount »** dans l'app, les routes ou
les chaînes : c'est une **marque déposée** (Bunq), à proscrire pour un produit grand public.
En interne : feature `src/features/depenses/`, route `/depenses`, tables préfixées `depense_*`,
namespace i18n `depenses.*`.

## 2. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Rattachement | Groupe avec `voyage_id` **nullable** : liable à un voyage **ou** autonome. |
| Participants | **Membres inscrits seulement** (partage par e-mail d'utilisateurs existants, modèle C4). Participants « libres » (sans compte) → slice 5b. |
| Répartition | **Égale + montants exacts.** Parts / pourcentages différés. |
| Règlement | **Soldes nets + transferts minimaux (suggestion) + remboursements enregistrés** (boucle complète). |
| Devise | **Une devise par groupe** (défaut `EUR`), sans conversion. Multi-devises différé. |

## 3. Représentation de l'argent (décision structurante)

**Entiers en centimes + parts toujours matérialisées.** Les montants sont stockés en `bigint`
centimes (jamais de float → zéro erreur d'arrondi). Quelle que soit la méthode de saisie (égale ou
exacte), on **persiste la part exacte de chaque participant en centimes** dans `depense_parts`. Le
calcul des soldes devient une simple `SUM`. La répartition égale gère le **reste** de façon
déterministe : `base = montant_cents / n` (division entière), `reste = montant_cents - base * n`,
les `reste` premiers participants (ordre stable par `profile_id`) reçoivent `base + 1`. Invariant :
`somme(part_cents) == montant_cents`.

*Alternatives écartées :* stocker mode + total et recalculer les parts à la volée (calculs dispersés,
risque d'incohérence) ; floats / `numeric` décimaux (arrondis fragiles sur les soldes).

## 4. Modèle de données (`supabase/migrations/00010_depenses.sql`)

```sql
create type public.depense_mode as enum ('egal', 'exact');

create table public.depense_groupes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  voyage_id uuid references public.voyages (id) on delete set null,
  titre text not null check (char_length(titre) <= 200),
  devise text not null default 'EUR' check (char_length(devise) = 3),
  created_at timestamptz not null default now()
);

create table public.depense_groupe_membres (
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (groupe_id, profile_id)
);

create table public.depenses (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  paye_par uuid not null references public.profiles (id) on delete cascade,
  libelle text not null check (char_length(libelle) <= 200),
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  mode public.depense_mode not null default 'egal',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.depense_parts (
  depense_id uuid not null references public.depenses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  part_cents bigint not null check (part_cents >= 0),
  primary key (depense_id, profile_id)
);

create table public.remboursements (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null references public.depense_groupes (id) on delete cascade,
  de_profile_id uuid not null references public.profiles (id) on delete cascade,
  vers_profile_id uuid not null references public.profiles (id) on delete cascade,
  montant_cents bigint not null check (montant_cents > 0),
  date date,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (de_profile_id <> vers_profile_id)
);
```

### RLS d'appartenance (helpers `security definer` anti-récursion — calque C4)

```sql
create function public.is_groupe_owner(g_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.depense_groupes where id = g_id and owner_id = auth.uid());
$$;

create function public.can_access_groupe(g_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.depense_groupes where id = g_id and owner_id = auth.uid())
      or exists (select 1 from public.depense_groupe_membres where groupe_id = g_id and profile_id = auth.uid());
$$;
```

- `depense_groupes` : RLS on, **une policy par commande** :
  - `select using (public.can_access_groupe(id))`,
  - `insert with check (owner_id = auth.uid())`,
  - `update using (public.can_access_groupe(id)) with check (public.can_access_groupe(id))` (édition collaborative des infos),
  - `delete using (public.is_groupe_owner(id))` → **suppression = owner-only**.
- `depense_groupe_membres` : `select using (public.can_access_groupe(groupe_id))` ;
  `insert/delete using/with check (public.is_groupe_owner(groupe_id))` → gestion membres owner-only.
- `depenses` : `for all using (public.can_access_groupe(groupe_id)) with check (public.can_access_groupe(groupe_id))` → collaboratif.
- `depense_parts` : accès gardé via le groupe de la dépense parente —
  `for all using (public.can_access_groupe((select groupe_id from public.depenses where id = depense_id)))`
  `with check (public.can_access_groupe((select groupe_id from public.depenses where id = depense_id)))`.
- `remboursements` : `for all using (public.can_access_groupe(groupe_id)) with check (public.can_access_groupe(groupe_id))` → collaboratif.

**Leçons de C4 appliquées d'emblée :**
- Trigger d'**immuabilité de `owner_id`** sur `depense_groupes` (before update → raise si `owner_id` change).
- Garde **`role <> 'owner'`** sur le delete de `depense_groupe_membres` (le owner ne peut être retiré).
- Trigger `on_groupe_created` : insère automatiquement la ligne membre `role='owner'` du créateur.

**+ grants explicites** `select, insert, update, delete` à `authenticated` sur les cinq tables.

## 5. Partage par e-mail (RPC `security definer` — calque C4)

```sql
create function public.share_groupe(p_groupe_id uuid, p_email text) returns text ...
-- 1) raise si auth.uid() null ; 2) raise si pas owner du groupe ;
-- 3) résout p_email -> auth.users.id (security definer) ; introuvable -> 'not_found' (pas d'énumération) ;
-- 4) insert into depense_groupe_membres (..., 'membre') on conflict do nothing ; 5) retourne 'ok'.
revoke execute ... from anon, public; grant execute ... to authenticated;
```
`unshare_groupe(p_groupe_id, p_profile_id)` : owner-only, supprime la ligne membre (jamais
`role='owner'`).

## 6. Logique métier (pure, testée — `domain/`)

- `computeParts(montantCents, mode, participantIds, exactsCents?)` → `{ profileId, partCents }[]`.
  - **égal** : reste réparti déterministe (cf. §3).
  - **exact** : valide `somme(exactsCents) === montantCents` (sinon erreur), une entrée par participant.
- `computeBalances(membres, depensesAvecParts, remboursements)` → `{ profileId, soldeCents }[]`.
  - Convention : payeur crédité de `montant_cents` ; chaque participant débité de sa `part_cents` ;
    remboursement A→B de `m` : A `+m`, B `−m`. **Invariant : somme des soldes = 0** (testé).
- `simplifyDebts(soldes)` → `{ deProfileId, versProfileId, montantCents }[]` : algorithme glouton
  appariant le plus gros débiteur au plus gros créancier jusqu'à épuisement. Nombre de transferts
  minimisé en pratique ; total reçu = total dû.

## 7. Données / actions (`data/`)

- `actions.ts` : `createGroupe` (`voyageId` optionnel ; si lié, **pré-remplit les membres** depuis
  `voyage_membres` du voyage), `updateGroupe`, `deleteGroupe` (owner), `addDepense` / `deleteDepense`,
  `addRemboursement` / `deleteRemboursement`, `shareGroupe` / `unshareGroupe` (RPC). Montants saisis
  **en euros** → convertis en **centimes** via transform Zod. `paye_par` / `created_by` / `owner_id`
  dérivés de la session, jamais du client. `addDepense` écrit la dépense **et** ses `depense_parts`
  (parts calculées par `computeParts`), en validant l'invariant somme = total.
- `queries.ts` : `getMesGroupes()` (possédés + partagés via RLS), `getGroupeDetail(id)` (groupe +
  dépenses+parts + remboursements + membres + **soldes** + **transferts** calculés ; throw si
  inaccessible).

## 8. UI (`ui/` + `app/[locale]/(app)/depenses/`)

- `/depenses` : « Comptes partagés » = mes groupes (possédés + partagés). `GroupeForm` (titre, devise,
  voyage optionnel parmi mes voyages), `GroupesList`.
- `/depenses/[id]` : `GroupeDetail` = entête (titre, devise, lien voyage si lié) · `DepensesList` ·
  `DepenseForm` (mode égal/exact + sélection des participants + montant) · **`SoldesPanel`** (solde
  par membre + suggestion de transferts « qui paie qui ») · `RemboursementForm` · `MembersList` +
  `ShareForm` (visible au owner). `error.tsx` sur le segment.
- `data-testid` : `groupe-form`, `groupe-card`, `depense-form`, `depense-row`, `soldes-panel`,
  `solde-row`, `transfert-row`, `remboursement-form`, `member-row`, `share-form`.
- **Intégration C4** : sur le détail d'un voyage, lien « Comptes partagés » qui crée/ouvre le groupe
  lié à ce voyage.
- Montants affichés via un format `centimes → devise` (helper d'affichage côté UI).

## 9. i18n

Namespace `depenses.*` dans `messages/fr.json` (titres, devise, mode égal/exact, libellés dépense /
payé par / participants / solde / transfert / remboursement / partage / membres, boutons, vide,
erreurs). Aucune chaîne en dur.

## 10. Sécurité

- Modèle multi-utilisateur via helpers `security definer` (anti-récursion). RLS sur les cinq tables
  + grants explicites.
- Partage par RPC owner-only : pas d'énumération d'e-mails (retour générique), `auth.uid()` enforcé,
  `revoke from anon, public` + `grant authenticated`.
- `owner_id` / `paye_par` / `created_by` toujours dérivés de la session. Pas de client service-role
  dans la couche données. Suppression du groupe et gestion des membres = owner-only. `owner_id`
  immuable. Le owner ne peut être retiré des membres.

## 11. Tests & seed

- **Unit (Vitest, TDD)** : schémas Zod (groupe / dépense / remboursement, transform euros→centimes),
  `computeParts` (égal avec reste 334/333/333 ; exact valide et invalide), `computeBalances`
  (invariant somme = 0), `simplifyDebts` (cas à 2 et 3 membres, total conservé).
- **Seed dev** : un groupe démo « Dépenses Rome » **lié au voyage « Week-end à Rome »**, partagé
  client ↔ agence ; 2 dépenses (une égale, une exacte) + 1 remboursement → démontre soldes et
  règlement. UUID v4 valides.
- **e2e (Playwright)** : (1) créer un groupe → ajouter une dépense égale → vérifier les soldes
  affichés ; (2) **2e contexte agence → voit le groupe partagé**, ajoute un remboursement → soldes
  mis à jour (preuve multi-utilisateur + boucle de règlement).
- CI : démarre déjà Supabase + applique migrations/seed ; les nouveaux e2e tournent en CI.

## 12. Arbitrages / dette signalés

- **Participants libres** (sans compte) → slice 5b dédié.
- **Répartition** : égale + exacts seulement ; parts / pourcentages différés.
- **Devise** : une par groupe, sans conversion ; multi-devises avec taux différé.
- **Export comptable** / récap par catégorie : hors périmètre.
- `depense_parts` : invariant somme = total **enforcé côté action** (PostgREST ne pose pas
  facilement une contrainte d'agrégat cross-lignes) ; un trigger de vérification est différé.
