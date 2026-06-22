# Chantier 7a — Famille (foyer + liste resto partagée) — Design

**Date :** 2026-06-22
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-7a-famille`

---

## 0. Contexte

Premier volet du Chantier 7 (Famille / Partage), découpé : **7a = Famille** (foyer + contenu
partagé) ; **7b = Agence ↔ clients** (portefeuille, agir pour le client) viendra ensuite. Une famille
est un foyer : un utilisateur la crée, invite des membres par e-mail, et le foyer dispose d'une
**liste de restos commune** que tous les membres alimentent. On réutilise les patterns établis :
modèle membres + helpers `security definer` anti-récursion (C4/C5), `owner_id` immuable, partage par
e-mail, l'infra restos/Places (`upsert_etablissement`). Architecture : `features/famille/{domain,data,
ui}`, RLS partout + grants, types dérivés du schéma, TDD, e2e.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Découpage | **7a Famille** (ce chantier) → **7b Agence-clients** (suivant). |
| Contenu partagé | **Liste resto commune au foyer.** Les listes perso (restos/vins/voyages) restent perso. |
| Cardinalité | **Une seule famille par utilisateur** (foyer), enforced DB via `UNIQUE(profile_id)`. |
| Gating | **Gratuit** (pas de gating premium). Plan Famille payant différé. |

## 2. Modèle de données (`supabase/migrations/00013_famille.sql`)

```sql
create table public.familles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.famille_membres (
  famille_id uuid not null references public.familles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  added_at timestamptz not null default now(),
  primary key (famille_id, profile_id),
  unique (profile_id)   -- une seule famille par utilisateur (foyer)
);

create table public.famille_restos (
  famille_id uuid not null references public.familles (id) on delete cascade,
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,  -- nullable (set null à la suppression du profil)
  created_at timestamptz not null default now(),
  primary key (famille_id, etablissement_id)
);

create index familles_owner_idx on public.familles (owner_id);
create index famille_restos_famille_idx on public.famille_restos (famille_id);
```

### Helpers `security definer` (anti-récursion)

```sql
create function public.is_famille_owner(f_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.familles where id = f_id and owner_id = auth.uid());
$$;

create function public.can_access_famille(f_id uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.familles where id = f_id and owner_id = auth.uid())
      or exists (select 1 from public.famille_membres where famille_id = f_id and profile_id = auth.uid());
$$;
```

### Triggers (leçons C4)

- `familles_lock_owner` (BEFORE UPDATE) : `owner_id` immuable.
- `on_famille_created` (AFTER INSERT) : insère la ligne `famille_membres` du owner (`role='owner'`).

### RLS & grants

- `familles` : select `can_access(id)` ; insert `owner_id = auth.uid()` ; update `using/with check
  can_access(id)` (renommer) ; delete `is_famille_owner(id)`.
- `famille_membres` : select `can_access(famille_id)` ; insert `with check is_famille_owner(famille_id)` ;
  delete `using (is_famille_owner(famille_id) and role <> 'owner')` (owner non retirable par cette voie).
- `famille_restos` : `for all using can_access(famille_id) with check can_access(famille_id)` (collaboratif).
- Grants explicites `select, insert, update, delete` à `authenticated` sur les 3 tables.

## 3. Appartenance & invitation (RPC `security definer`)

```sql
-- owner invite par e-mail ; pas d'énumération ; gère l'unicité de foyer
create function public.inviter_famille(p_famille_id uuid, p_email text) returns text ...
-- 1) raise si auth.uid() null ; 2) raise si pas owner ;
-- 3) résout p_email -> auth.users.id ; introuvable -> 'not_found' ;
-- 4) si = soi -> 'self' ;
-- 5) insert into famille_membres (..., 'membre') ; si UNIQUE(profile_id) viole -> 'deja_famille' ;
-- 6) 'ok'.
```
- `quitter_famille()` : un membre (role `membre`) supprime sa propre ligne ; le owner ne peut pas
  quitter (il supprime la famille). `retirer_membre(p_profile_id)` : owner-only, jamais `role='owner'`.
- Le `quitter`/`retirer` libère la contrainte d'unicité → la personne peut rejoindre une autre famille.
- Invitation = **ajout direct** (pattern C4/C5). Invitation-avec-consentement différée.

## 4. Liste resto partagée

`famille_restos` lie le foyer à des `etablissements`. Ajout par n'importe quel membre :
- depuis une **fiche resto** : bouton « Ajouter à ma famille » (si l'utilisateur a une famille) →
  insère `(famille_id, etablissement_id, added_by)` ;
- depuis `/famille` : recherche Places → `upsert_etablissement` (RPC existante) → `famille_restos`.
Retrait par n'importe quel membre. Les listes perso (`liste_items`) ne sont pas touchées.

## 5. Logique métier (pure, testée — `features/famille/domain/`)

- `schemas.ts` : `familleInputSchema` (`nom` 1..120) ; `inviteSchema` (`email`) ; `ajoutRestoSchema`
  (`etablissementId` uuid) ou `placeId` pour l'ajout via recherche. (Peu de logique pure ici ; le
  cœur est la RLS/RPC.)

## 6. Données / actions (`features/famille/data/`)

- `actions.ts` : `creerFamille` (nom ; `owner_id` session ; échoue si déjà dans une famille — la
  contrainte d'unicité via le trigger owner-membre), `inviterMembre` (RPC `inviter_famille` ; mappe
  `not_found`/`self`/`deja_famille`), `retirerMembre` (RPC), `quitterFamille` (RPC), `supprimerFamille`
  (owner ; `.select().maybeSingle()`), `ajouterResto` (depuis fiche : etablissementId ; ou via Places :
  placeId → upsert), `retirerResto`, `chercherEtablissements(query)` (Places).
- `queries.ts` : `getMaFamille()` (la famille de l'utilisateur — possédée ou rejointe — + membres, ou
  null), `getFamilleRestos(familleId)` (jointure établissement).

## 7. UI (`/famille` + `features/famille/ui/`)

- `app/[locale]/(app)/famille/page.tsx` : si `getMaFamille()` null → `FamilleForm` (créer un foyer) ;
  sinon → entête (nom), `MembresList` (membres ; owner peut inviter via `InviteForm` / retirer ;
  membre peut quitter), `FamilleRestosList` (restos partagés + retrait) + ajout via recherche
  (`EtablissementSearch`). `error.tsx` sur le segment.
- **Fiche resto** (`features/restos/ui/FicheResto.tsx`) : bouton « Ajouter à ma famille » si
  l'utilisateur a une famille (lit `getMaFamille()`). Sinon rien (ou lien discret vers `/famille`).
- Composants : `FamilleForm`, `MembresList`, `InviteForm`, `FamilleRestosList`, `EtablissementSearch`.
  `data-testid` : `famille-form`, `invite-form`, `membre-row`, `famille-resto-row`, `resto-search`,
  `ajouter-famille` (bouton fiche).

## 8. i18n

Namespace `famille.*` dans `messages/fr.json` (titre, créer/nommer, inviter/e-mail, membres, quitter,
retirer, supprimer, liste resto, ajouter/rechercher/retirer, vide, messages
`deja_famille`/`not_found`, erreurs). Aucune chaîne en dur.

## 9. Sécurité

- Accès owner **ou** membre via helpers `security definer` (anti-récursion). RLS sur les 3 tables +
  grants. `owner_id`/`added_by` de la session.
- Invitation owner-only via RPC, sans énumération d'e-mails (retour générique `not_found`).
- **Une famille par utilisateur** : `UNIQUE(profile_id)` sur `famille_membres` (DB-level, non
  contournable). `owner_id` immuable ; owner non retirable.

## 10. Tests & seed

- **Unit (Vitest, TDD)** : schémas (`familleInputSchema` nom requis ≤120 ; `inviteSchema` email).
- **Seed dev** : **aucune** famille pré-créée pour `client`/`agence` (pour ne pas heurter la contrainte
  d'unicité dans les e2e d'autres chantiers qui utilisent ces comptes). Comptes dédiés créés au besoin.
- **e2e (Playwright)** — sur comptes dédiés isolés (la contrainte « une famille/utilisateur » interdit
  de réutiliser des comptes qu'un autre test placerait dans une famille) :
  (1) un compte dédié crée une famille → invite un 2ᵉ compte dédié → ajoute un resto (recherche) → un
  2ᵉ contexte (l'invité) voit la famille + le resto partagé ;
  (2) inviter un compte **déjà dans une famille** → message « déjà dans une famille » (`deja_famille`).
  Signaux déterministes.

## 11. Arbitrages / dette signalés

- Invitation avec **consentement** (accept/refuse) → différée (ici ajout direct).
- **Plusieurs familles** par utilisateur → différé (foyer unique).
- Partage d'autres contenus (vins, voyages au niveau foyer) → différé.
- **Plan Famille payant** (gating premium) → différé.
- Rôles fins (admin de famille, lecteur) → différés.
- **7b Agence ↔ clients** → chantier suivant.
