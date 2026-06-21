# Chantier 4 — Voyages (réservations + partage) — Design

**Date :** 2026-06-21
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-4-voyages`

---

## 0. Contexte

Quatrième chantier de Vito : module Voyages — stockage des voyages, réservations (hôtel/vol/
voiture + coordonnées conciergerie), et **partage entre amis** (premier modèle multi-utilisateur du
projet). On respecte l'architecture en place : `features/<module>/{domain,data,ui}`, RLS partout +
grants explicites, types dérivés du schéma, TDD, e2e. Diagnostic-first, un slice vertical testé.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Périmètre | **voyages + réservations + partage.** Les **documents chiffrés** sont un slice 4b dédié (suit ce chantier). |
| Chiffrement documents (pour 4b) | **AES-256-GCM applicatif, clé hors DB** (Vercel env, server-only). Hors périmètre de CE chantier mais acté. |
| Rôles membres | **Binaires (owner / membre), membres collaboratifs** (peuvent CRUD les réservations du voyage partagé). Rôles fins (lecteur/éditeur) différés. |
| Partage | **Utilisateurs existants par e-mail** (via RPC `security definer`). Liens publics / invitation de non-inscrits différés. |

## 2. Modèle de données (`supabase/migrations/00009_voyages.sql`)

```sql
create type public.voyage_statut as enum ('planifie', 'confirme', 'en_cours', 'termine');
create type public.reservation_type as enum ('hotel', 'vol', 'voiture', 'hebergement', 'autre');

create table public.voyages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  titre text not null check (char_length(titre) <= 200),
  destination text check (destination is null or char_length(destination) <= 200),
  date_debut date,
  date_fin date,
  statut public.voyage_statut not null default 'planifie',
  created_at timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create table public.voyage_membres (
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (voyage_id, profile_id)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  type public.reservation_type not null default 'autre',
  fournisseur text,
  reference text,
  date_debut date,
  date_fin date,
  conciergerie_tel text,
  conciergerie_mail text,
  lien text,                 -- url Airbnb/PAP/etc.
  notes text,
  created_at timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);
```

### RLS d'appartenance (helpers `security definer` anti-récursion)

```sql
create function public.is_voyage_owner(v_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.voyages where id = v_id and owner_id = auth.uid());
$$;

create function public.can_access_voyage(v_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.voyages where id = v_id and owner_id = auth.uid())
      or exists (select 1 from public.voyage_membres where voyage_id = v_id and profile_id = auth.uid());
$$;
```
(Ces fonctions tournent en `security definer` → elles lisent `voyages`/`voyage_membres` sans
re-déclencher la RLS, ce qui évite la récursion classique entre les policies des deux tables.)

- `voyages` : RLS on, **une policy par commande** :
  - `for select using (public.can_access_voyage(id))` (owner + membres),
  - `for insert with check (owner_id = auth.uid())` (on crée son propre voyage),
  - `for update using (public.can_access_voyage(id)) with check (public.can_access_voyage(id))` (édition collaborative des infos du voyage),
  - `for delete using (public.is_voyage_owner(id))` → **suppression du voyage = owner-only**.
- `reservations` : RLS on. `for all using (public.can_access_voyage(voyage_id)) with check
  (public.can_access_voyage(voyage_id))` → planification collaborative (membres CRUD).
- `voyage_membres` : RLS on. `for select using (public.can_access_voyage(voyage_id))` ;
  `for insert/delete using/with check (public.is_voyage_owner(voyage_id))` → seul le owner gère le partage.

+ grants explicites `select, insert, update, delete` à `authenticated` sur les trois tables.

## 3. Partage par e-mail (RPC `security definer`)

```sql
create function public.share_voyage(p_voyage_id uuid, p_email text) returns text ...
-- 1) raise si auth.uid() null ; 2) raise si pas owner du voyage ;
-- 3) résout p_email -> auth.users.id (security definer) ; si introuvable -> retourne 'not_found'
--    (pas d'énumération : message générique, aucune autre donnée) ;
-- 4) insert into voyage_membres (voyage_id, profile_id, 'membre') on conflict do nothing ;
-- 5) retourne 'ok'.
revoke execute ... from anon, public; grant execute ... to authenticated;
```
`unshare_voyage(p_voyage_id, p_profile_id)` : owner-only, supprime la ligne `voyage_membres`
(jamais la ligne `role='owner'`). Le owner ne peut pas se retirer lui-même.

## 4. UI

- `(app)/voyages/page.tsx` : « Mes voyages » = possédés **+** partagés avec moi (`getMesVoyages`).
- `(app)/voyages/[id]/page.tsx` : détail = infos voyage + liste réservations + `ReservationForm` +
  liste membres + `ShareForm` (visible au owner). Coordonnées conciergerie **cliquables**
  (`tel:` / `mailto:`). `error.tsx` sur le segment.
- Composants : `VoyageForm`, `VoyagesList`, `VoyageDetail`, `ReservationForm`, `ShareForm`,
  `MembersList`. `data-testid` : `voyage-form`, `voyage-card`, `reservation-form`, `reservation-row`,
  `share-form`, `member-row`.

## 5. Données / actions

- `data/actions.ts` : `createVoyage`, `updateVoyage`, `deleteVoyage` (owner-only),
  `addReservation`, `deleteReservation`, `shareVoyage` (RPC), `unshareVoyage` (RPC). `owner_id`/
  `created_by` de la session ; validation Zod ; retours `{error}`.
- `data/queries.ts` : `getMesVoyages()` (owned + shared, via RLS), `getVoyageDetail(id)`
  (voyage + réservations + membres ; throw si inaccessible).

## 6. Sécurité

- **Premier modèle multi-utilisateur** : accès par owner **ou** appartenance, via helpers
  `security definer` (anti-récursion). RLS sur les trois tables + grants explicites.
- **Partage par RPC owner-only** : pas d'énumération d'e-mails (retour générique), aucune donnée
  d'autrui exposée, `auth.uid()` enforcé, `revoke from anon, public` + `grant authenticated`.
- `owner_id`/`created_by` toujours dérivés de la session, jamais du client. Pas de client
  service-role dans la couche données. Suppression du voyage et gestion des membres = owner-only.

## 7. i18n

Namespace `voyages.*` dans `messages/fr.json` (titres, statuts, types de réservation, libellés
réservation/conciergerie/partage/membres, boutons, vide, erreurs). Aucune chaîne en dur.

## 8. Tests & seed

- **Unit (Vitest, TDD)** : schémas Zod (voyage/réservation/partage), validation `date_fin >=
  date_debut`, mapping.
- **Seed dev** : 1 voyage démo du client (1 réservation hôtel + coordonnées conciergerie),
  **partagé avec le compte agence** (`voyage_membres`) → démontre le multi-utilisateur. UUID v4.
- **e2e (Playwright)** : (1) créer un voyage → ajouter une réservation → partager avec
  `agence@vito.test` ; (2) **dans un 2e contexte, se connecter en agence → le voyage partagé
  apparaît** dans « Mes voyages » (preuve du partage cross-utilisateur).
- CI : démarre déjà Supabase + applique migrations/seed ; les nouveaux e2e tournent en CI.

## 9. Arbitrages / dette signalés

- **Documents chiffrés** → slice 4b dédié (AES-256-GCM, clé hors DB).
- **Partage** : utilisateurs existants par e-mail uniquement ; liens publics / non-inscrits différés.
- **Rôles membres** binaires + collaboratifs (membres CRUD réservations) ; rôles fins différés.
- **Tricount** (Chantier 5) et **chat conciergerie** (Chantier 6) hors périmètre.
- **Réservations** : champs génériques (pas de champs riches par type) — extensible plus tard.
