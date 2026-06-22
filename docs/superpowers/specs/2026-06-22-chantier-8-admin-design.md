# Chantier 8 — Back-office admin (lecture seule) — Design

**Date :** 2026-06-22
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-8-admin`

---

## 0. Contexte

Huitième et dernier chantier du roadmap initial : le **back-office admin**. Le rôle `admin` et la
permission `access:admin` existent (C1) mais il n'y a aucune route `/admin`. La vision C1 (row 8) =
« suivi users/abonnements/demandes/activité — vues admin, **lecture transverse via policies admin** ».
Ce slice livre un **tableau de bord admin en lecture seule** : utilisateurs, abonnements, demandes de
conciergerie, et compteurs (KPI). On réutilise l'infra RLS existante (`profiles` admin-read déjà en
place ; `conciergerie_demandes` lu par `is_concierge()` qui inclut admin) et `isPremiumFrom` (6a).

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Périmètre | **Tableau de bord en lecture seule.** Aucune mutation. Actions admin (rôles, modération, tags) → slices ultérieurs. |
| Vues | **Utilisateurs + Abonnements + Conciergerie + compteurs** (total users, premium actifs, demandes par statut). |
| Accès | Lecture transverse via **policies admin** ; `/admin` réservé au rôle `admin`. |

## 2. Modèle / accès (`supabase/migrations/00015_admin.sql`)

Aucune nouvelle table. Une seule policy à ajouter (les autres lectures admin existent déjà).

```sql
create function public.is_admin() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') = 'admin';
$$;

-- subscriptions : aujourd'hui select-own (00011). On AJOUTE une policy permissive admin-read.
create policy "subscriptions_select_admin" on public.subscriptions for select
  using (public.is_admin());

revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;
```
- `profiles` : l'admin lit déjà tout (`profiles_select_self_or_admin`, 00001).
- `conciergerie_demandes` : l'admin lit déjà tout via `conciergerie_select` (`... or is_concierge()`,
  `is_concierge` = rôle `agence`/`admin`, 00012).
- Les policies RLS sont permissives (OR) : ajouter `subscriptions_select_admin` ne retire rien aux
  utilisateurs (qui gardent leur select-own).

## 3. Logique métier (pure, testée — `features/admin/domain/`)

- `computeAdminStats(data, now)` où `data = { users: {id}[]; subscriptions: { status: string;
  currentPeriodEnd: string }[]; demandes: { statut: string }[] }` →
  `{ totalUsers: number; premiumActifs: number; demandesParStatut: Record<string, number> }`.
  - `totalUsers = users.length`.
  - `premiumActifs = subscriptions.filter((s) => isPremiumFrom(s, now)).length` (réutilise
    `isPremiumFrom` de `@/features/abonnement/domain/premium` : actif **ou** annulé-non-expiré).
  - `demandesParStatut` : compte par `statut`.
  Fonction pure, testée.

## 4. Données (`features/admin/data/queries.ts`)

- `getAdminUsers()` → `profiles` (id, role, display_name, created_at), ordonné `created_at desc`.
- `getAdminSubscriptions()` → `subscriptions` (user_id, status, period, current_period_end).
- `getAdminDemandes()` → `conciergerie_demandes` (id, type, statut, created_at).
Chacune est scoppée par RLS admin (l'appelant doit être admin ; la page garde le rôle). Erreurs
remontées (`throw`).

## 5. UI (`/admin` + `features/admin/ui/`)

- `app/[locale]/(app)/admin/page.tsx` : **`await requireRole(["admin"])` en première instruction**
  (redirige les non-admin). Fetch des 3 listes → `computeAdminStats(...)` → rend :
  - `StatsCards` (KPI : total users, premium actifs, demandes par statut),
  - `UsersTable`, `SubscriptionsTable`, `DemandesTable` (lecture seule).
  `error.tsx` sur le segment.
- `data-testid` : `admin-stats`, `users-table`, `subscriptions-table`, `demandes-table`.

## 6. i18n

Namespace `admin.*` dans `messages/fr.json` (titre, KPI : utilisateurs/premium/demandes, en-têtes de
colonnes : rôle/nom/date/statut/type/période, libellés statuts conciergerie réutilisés ou propres,
vide). Aucune chaîne en dur.

## 7. Sécurité

- `/admin` réservé au rôle `admin` via `requireRole(["admin"])` (fail-closed, redirige). Lecture
  transverse via policies admin (`is_admin`/`is_concierge`/`profiles_select_self_or_admin`).
- **Lecture seule** : aucune action/mutation dans ce slice → surface d'écriture nulle.
- `is_admin()` `security definer set search_path = ''`, revoke anon/public.

## 8. Tests & seed

- **Unit (Vitest, TDD)** : `computeAdminStats` (totalUsers ; premiumActifs via `isPremiumFrom` —
  inclut un abonnement annulé-non-expiré, exclut un annulé-expiré ; `demandesParStatut`).
- **Seed dev** : inchangé. Données existantes suffisantes : plusieurs profils (client/agence/admin +
  comptes dédiés), `premium@vito` a un abonnement actif, une demande conciergerie démo existe.
- **e2e (Playwright)** : (1) `admin@vito.test` → `/admin` → voit `admin-stats` (KPI peuplés, ≥ valeurs
  attendues) + `users-table`/`subscriptions-table`/`demandes-table` avec des lignes ; (2) **gating** :
  `client@vito.test` → `/admin` → accès refusé (n'y reste pas, contenu admin absent). Signaux
  déterministes.

## 9. Arbitrages / dette signalés

- **Actions admin** (changer un rôle — anti-escalade, modération, gestion des tags système) → slices
  ultérieurs.
- Pagination / filtres / recherche des tableaux ; métriques d'activité tous-modules (voyages, familles,
  dépenses) ; export CSV ; graphiques → différés.
- Le `display_name` est lisible par l'admin (policy `profiles` admin) — pas de limitation ici, contrairement
  aux vues co-membres des autres modules.
