# Chantier 6b — Conciergerie (demandes de réservation) — Design

**Date :** 2026-06-22
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-6b-conciergerie`

---

## 0. Contexte

Second volet du Chantier 6 (après 6a Abonnement) : la **conciergerie**, un service **premium** où un
client soumet une **demande de réservation structurée** (resto ou hôtel) que l'équipe concierge (staff
= rôles `agence`/`admin`) traite. Gaté par `is_premium` (6a). On réutilise : l'abstraction Places
(recherche d'hôtels mock), la RPC `upsert_etablissement`, les rôles RBAC, et les patterns RLS
multi-utilisateur (C4/C5). Architecture en place : `features/conciergerie/{domain,data,ui}`, RLS
partout + grants, types dérivés du schéma, TDD, e2e.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Nature | **Demande de réservation structurée** (resto/hôtel), traitée par le staff concierge (boîte partagée). |
| Interaction | **Statut** (`nouvelle`→`en_cours`→`confirmee`/`refusee`) + **une réponse** concierge. Pas de chat multi-tours. |
| Cible | Resto & hôtel référencent un `etablissement_id`. Resto **pré-sélectionné depuis sa fiche** ; hôtel **recherché-sélectionné** (catalogue via Places, mock étendu, `categorie='hotel'`). |
| Accès | **Premium-only** pour créer (sinon CTA `/abonnement`) ; staff (agence/admin) traite tout. Entrées : **bouton fiche resto** + page **`/conciergerie`**. |

## 2. Principe d'architecture (leçons 6a)

- **Gating premium enforced en RLS** : la policy `insert` porte `with check (user_id = auth.uid() and
  public.is_premium(auth.uid()))` → non contournable via PostgREST direct. Le check côté action n'est
  que pour l'UX (message/CTA).
- **Staff via claim JWT** : helper `is_concierge()` lit `auth.jwt() ->> 'user_role'` (`agence`/`admin`).
- `repondu_par`/`user_id` dérivés de la session, jamais du client.

## 3. Modèle de données (`supabase/migrations/00012_conciergerie.sql`)

```sql
create type public.conciergerie_type as enum ('resto', 'hotel');
create type public.conciergerie_statut as enum ('nouvelle', 'en_cours', 'confirmee', 'refusee');

create table public.conciergerie_demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.conciergerie_type not null,
  etablissement_id uuid not null references public.etablissements (id) on delete restrict,
  statut public.conciergerie_statut not null default 'nouvelle',
  avec_enfants boolean not null default false,
  nb_enfants integer not null default 0 check (nb_enfants >= 0),
  commentaire text check (commentaire is null or char_length(commentaire) <= 2000),
  -- resto
  date_resa date,
  heure_resa time,
  nombre_convives integer check (nombre_convives is null or nombre_convives > 0),
  chaise_haute boolean,
  occasion text check (occasion is null or occasion in ('amis','famille','anniversaire','autre')),
  -- hôtel
  date_debut date,
  nombre_nuits integer check (nombre_nuits is null or nombre_nuits > 0),
  sejour_type text check (sejour_type is null or sejour_type in ('loisirs','pro')),
  enfants_ages integer[],
  -- réponse concierge
  reponse text check (reponse is null or char_length(reponse) <= 2000),
  repondu_par uuid references public.profiles (id) on delete set null,
  repondu_le timestamptz,
  created_at timestamptz not null default now(),
  -- cohérence par type
  check (type <> 'resto' or (date_resa is not null and heure_resa is not null and nombre_convives is not null)),
  check (type <> 'hotel' or (date_debut is not null and nombre_nuits is not null))
);

create index conciergerie_demandes_user_idx on public.conciergerie_demandes (user_id);
create index conciergerie_demandes_statut_idx on public.conciergerie_demandes (statut);
```

### Helper `security definer` (staff)

```sql
create function public.is_concierge() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('agence', 'admin');
$$;
```

### RLS & grants

```sql
alter table public.conciergerie_demandes enable row level security;

create policy "conciergerie_select" on public.conciergerie_demandes for select
  using (user_id = auth.uid() or public.is_concierge());

-- premium-only à la création, et toujours pour soi-même (gating DB-level)
create policy "conciergerie_insert" on public.conciergerie_demandes for insert
  with check (user_id = auth.uid() and public.is_premium(auth.uid()));

-- seul le staff fait évoluer statut/réponse
create policy "conciergerie_update" on public.conciergerie_demandes for update
  using (public.is_concierge()) with check (public.is_concierge());

-- le client peut annuler sa demande ; le staff aussi
create policy "conciergerie_delete" on public.conciergerie_demandes for delete
  using (user_id = auth.uid() or public.is_concierge());

grant select, insert, update, delete on public.conciergerie_demandes to authenticated;

revoke execute on function public.is_concierge() from anon, public;
grant execute on function public.is_concierge() to authenticated;
```
(`is_premium` est déjà défini/granté en 00011.)

## 4. Recherche d'hôtels (catalogue, via Places)

Réutilise l'abstraction `lib/services/places` : le **mock** renvoie quelques hôtels de démo (places
typées hôtel). Le flux : `chercherHotels(query)` → résultats → sélection → `upsert_etablissement`
(RPC existante, via `mapPlaceToEtablissement`) → `etablissement_id` de `categorie='hotel'`. Pas de
nouveau provider ; pas de catalogue navigable (recherche-à-la-demande uniquement). La demande resto
ne fait pas de recherche : `etablissement_id` provient de la fiche resto.

## 5. Logique métier (pure, testée — `features/conciergerie/domain/`)

- `dureeFromNuits(dateDebut: string, nombreNuits: number): string` — date de fin = `dateDebut +
  nombreNuits` (pure, testée ; gère le passage de mois).
- Schémas Zod :
  - `demandeRestoSchema` : `etablissementId` (string), `dateResa` (date), `heureResa` (HH:MM),
    `nombreConvives` (int > 0), `avecEnfants` (bool), `nbEnfants` (int ≥ 0), `chaiseHaute` (bool),
    `occasion` (`amis|famille|anniversaire|autre`), `commentaire?`.
  - `demandeHotelSchema` : `etablissementId`, `dateDebut` (date), `nombreNuits` (int > 0),
    `sejourType` (`loisirs|pro`), `avecEnfants`, `nbEnfants`, `enfantsAges?` (int[]), `commentaire?`.
  - `reponseSchema` : `statut` (`nouvelle|en_cours|confirmee|refusee`), `reponse?` (≤ 2000).

## 6. Données / actions (`features/conciergerie/data/`)

- `actions.ts` :
  - `creerDemandeResto(_prev, formData)` / `creerDemandeHotel(_prev, formData)` — `user_id` de la
    session ; premium vérifié côté action (UX) **et** RLS (autorité) ; insert typé.
  - `repondreDemande(_prev, formData)` — staff : `statut` (+ `reponse`), pose `repondu_par =
    auth.uid()`, `repondu_le = now()` ; RLS update staff-only.
  - `supprimerDemande(_prev, formData)` — owner ou staff (`.select().maybeSingle()` pour 0-ligne).
  - `chercherHotels(query: string)` — `getPlacesProvider().search` (filtré hôtel) ; garde premium.
- `queries.ts` : `getMesDemandes()` (client, les siennes), `getInboxConciergerie()` (staff, toutes —
  RLS renvoie tout si `is_concierge`), `getDemande(id)` (jointures établissement + nom client).

## 7. UI (`ui/` + `app/[locale]/(app)/conciergerie/`)

- **Fiche resto** (`features/restos/ui/FicheResto.tsx`) : bouton « Demander une réservation
  (conciergerie) ». Premium → ouvre `DemandeRestoForm` (resto pré-rempli, `etablissement_id`) ;
  non-premium → lien CTA `/abonnement` (`data-testid="conciergerie-premium-cta"`). L'état premium est
  lu via `getIsPremium()` (server component).
- **`/conciergerie`** : 
  - client → `DemandesList` (mes demandes : type, établissement, statut, réponse) + `DemandeHotelForm`
    (recherche hôtel + champs).
  - staff (`is_concierge`) → `ConciergeInbox` (toutes les demandes + `ReponseForm` : statut + réponse).
  - `error.tsx` sur le segment.
- Composants : `DemandeRestoForm`, `DemandeHotelForm`, `DemandesList`, `DemandeDetail`,
  `ConciergeInbox`, `ReponseForm`. `data-testid` : `demande-resto-form`, `demande-hotel-form`,
  `hotel-search`, `demande-row`, `concierge-inbox`, `reponse-form`, `conciergerie-premium-cta`,
  `demande-statut`.

## 8. i18n

Namespace `conciergerie.*` dans `messages/fr.json` (titres, types resto/hôtel, statuts, occasions,
type de séjour, libellés des champs — date/heure/convives/enfants/chaise haute/nuits/âges/commentaire,
réponse, boutons, CTA premium, vide, erreurs). Aucune chaîne en dur.

## 9. Sécurité

- **Premium-only infalsifiable** : `with check is_premium(auth.uid())` sur l'insert (DB-level).
- **Staff-only** pour statut/réponse : policy update `is_concierge()`. Client ne peut pas modifier le
  statut ni se répondre à lui-même.
- `user_id`/`repondu_par` toujours de la session. RLS : un client ne voit que ses demandes ; le staff
  voit tout. Pas d'exposition des demandes d'autrui à un client.

## 10. Tests & seed

- **Unit (Vitest, TDD)** : `dureeFromNuits` (cas simple + passage de mois) ; `demandeRestoSchema`
  (convives > 0, occasion valide) ; `demandeHotelSchema` (nuits > 0, sejourType valide) ;
  `reponseSchema`.
- **Seed dev** : quelques hôtels de démo dans le mock Places ; une demande resto démo du client
  **premium** (`premium@vito.test`, déjà premium via 00011), `type='resto'`, statut `nouvelle`, sur un
  resto seed existant.
- **e2e (Playwright)** :
  (1) **premium depuis une fiche resto** (`premium@vito.test`) → bouton conciergerie → remplir
  `DemandeRestoForm` → la demande apparaît dans `/conciergerie` (statut `nouvelle`) ;
  (2) **staff traite** (`agence@vito.test`) → ouvre `/conciergerie` (inbox) → répond (statut
  `confirmee` + message) → le client la voit `confirmee` avec la réponse ;
  (3) **Free bloqué** (`free@vito.test`) → fiche resto → voit `conciergerie-premium-cta` (pas de
  formulaire).
  Comptes dédiés (premium/agence/free), isolés ; signaux déterministes.

## 11. Arbitrages / dette signalés

- Fil de discussion multi-tours, realtime/notifications, pièces jointes → différés.
- Catalogue hôtels navigable complet → différé (ici recherche-à-la-demande via Places mock).
- Demande resto en texte libre (sans établissement) → hors périmètre (resto = établissement existant).
- Assignation 1:1 d'une demande à un concierge → différée (boîte partagée).
- Edition d'une demande par le client après envoi → différée (il peut annuler/supprimer).
