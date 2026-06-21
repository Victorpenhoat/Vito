# Chantier 6a — Abonnement (Free / Premium) — Design

**Date :** 2026-06-22
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-6a-abonnement`

---

## 0. Contexte

Sixième chantier de Vito, découpé : **6a = Abonnement** (facturation, niveaux, gating de
fonctionnalités) ; **6b = Conciergerie** (service premium, gaté par l'abonnement, chantier suivant).
Ce slice met en place le premier système de monétisation : niveaux Free/Premium, paiement
**mock-first** (adaptateur Stripe gaté par env, zéro coût), et une **barrière premium réelle**
(limite de voyages en Free). On respecte l'architecture en place : `features/<module>/{domain,data,ui}`,
abstraction de service mock-first (`lib/services/<provider>/`), RLS partout + grants explicites,
types dérivés du schéma, TDD, e2e.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Découpage | **6a Abonnement** (ce chantier) → **6b Conciergerie** (suivant). |
| Niveaux | **Free + Premium**, périodicité **mensuelle & annuelle**. Niveaux Pro/Famille différés. |
| Paiement | **Mock-first** (`PaymentProvider`), adaptateur **Stripe gaté par env** différé. |
| Gating | **Free plafonné à 2 voyages** (`FREE_VOYAGE_LIMIT = 2`) ; Premium illimité. Helper `isPremium` réutilisable (6b). |
| Annulation | Premium **jusqu'à la fin de période payée** ; `isPremium` = `active` OU (`canceled` ET `current_period_end > now()`). Renouvellement auto différé. |

## 2. Principe d'architecture (leçon C5 : enforcement DB-level)

Le gating et le statut premium ne doivent **jamais** dépendre uniquement d'un check côté action
(contournable via PostgREST direct avec le JWT de l'utilisateur) :

- **Statut premium non modifiable par le client** : la table `subscriptions` est en **lecture seule**
  pour `authenticated` (select de sa propre ligne) ; les écritures passent **uniquement** par des RPC
  `security definer` (mock subscribe / cancel) ou le service-role (webhook Stripe réel, différé).
  Sinon un utilisateur se met premium en insérant une ligne.
- **Limite de voyages enforced en base** : un **trigger `BEFORE INSERT` sur `voyages`** refuse la
  création si l'utilisateur n'est pas premium et possède déjà `FREE_VOYAGE_LIMIT` voyages. Le check
  proactif dans l'action `createVoyage` n'est que pour l'UX (message clair) ; le trigger est le garde
  autoritaire.

## 3. Modèle de données (`supabase/migrations/00011_abonnements.sql`)

```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  tier text not null default 'premium' check (tier in ('premium')),
  status text not null check (status in ('active', 'canceled')),
  period text not null check (period in ('monthly', 'yearly')),
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);
```

### Helper `security definer` (statut premium)

```sql
create function public.is_premium(uid uuid) returns boolean
  language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = uid
      and (status = 'active' or (status = 'canceled' and current_period_end > now()))
  );
$$;
```

### RPC `security definer` (souscription mock / annulation)

```sql
-- Mock : active premium immédiatement (le vrai Stripe passera par un webhook service-role).
create function public.mock_subscribe(p_period text) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_end timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'authentification requise'; end if;
  if p_period not in ('monthly', 'yearly') then raise exception 'période invalide'; end if;
  v_end := now() + (case p_period when 'monthly' then interval '1 month' else interval '1 year' end);
  insert into public.subscriptions (user_id, tier, status, period, current_period_end)
  values (v_uid, 'premium', 'active', p_period, v_end)
  on conflict (user_id) do update
    set status = 'active', period = excluded.period,
        current_period_end = excluded.current_period_end, updated_at = now();
end;
$$;

create function public.cancel_subscription() returns void
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'authentification requise'; end if;
  update public.subscriptions set status = 'canceled', updated_at = now()
  where user_id = v_uid;  -- garde current_period_end : premium jusqu'à la fin de période
end;
$$;
```

### Trigger de limite de voyages (gating DB-level)

```sql
create function public.enforce_voyage_limit() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_premium(new.owner_id)
     and (select count(*) from public.voyages where owner_id = new.owner_id) >= 2 then
    raise exception 'limite_voyages_free' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger voyages_free_limit before insert on public.voyages
  for each row execute function public.enforce_voyage_limit();
```
(`FREE_VOYAGE_LIMIT = 2` est codé en dur dans le trigger **et** exposé côté app via une constante
domain — les deux doivent rester synchronisés ; documenté dans la constante.)

### RLS & grants

```sql
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid());
-- AUCUNE policy insert/update/delete : pas d'écriture directe par authenticated.
grant select on public.subscriptions to authenticated;
-- (pas de grant insert/update/delete : écriture via RPC security definer / service-role uniquement)

revoke execute on function public.is_premium(uuid) from anon, public;
revoke execute on function public.mock_subscribe(text) from anon, public;
revoke execute on function public.cancel_subscription() from anon, public;
grant execute on function public.is_premium(uuid) to authenticated;
grant execute on function public.mock_subscribe(text) to authenticated;
grant execute on function public.cancel_subscription() to authenticated;
```

## 4. Abstraction paiement (`src/lib/services/payment/`)

Pattern mock-first identique à `places`/`merchant`/`enrichment` :
- `types.ts` : interface `PaymentProvider` avec `checkout(plan: { period: "monthly" | "yearly" }):
  Promise<CheckoutResult>` où `CheckoutResult = { mode: "activated" } | { mode: "redirect"; url: string }`.
- `mock.ts` : `checkout()` → `{ mode: "activated" }` (le mock « réussit » immédiatement ; l'action
  appelle ensuite la RPC `mock_subscribe`).
- `index.ts` : `getPaymentProvider()` → mock par défaut ; adaptateur Stripe (`stripe.ts`) **gaté par
  `STRIPE_SECRET_KEY`** et différé (renverrait `{ mode: "redirect", url }` vers Stripe Checkout).
- `mock.test.ts` : le mock renvoie bien `activated`.

## 5. Logique métier (pure, testée — `src/features/abonnement/domain/`)

- `constants.ts` : `export const FREE_VOYAGE_LIMIT = 2;` (commentaire : doit rester synchronisé avec le
  trigger SQL `enforce_voyage_limit`).
- `premium.ts` : `isPremiumFrom(sub: { status: string; currentPeriodEnd: string } | null, now: Date):
  boolean` — **fonction pure**, miroir exact de la SQL `is_premium` : `true` si `sub` non nul et
  (`status==='active'` OU (`status==='canceled'` ET `new Date(currentPeriodEnd) > now`)).
- `schemas.ts` : `subscribeSchema` (`period: z.enum(["monthly","yearly"])`).

## 6. Données / actions (`src/features/abonnement/data/`)

- `actions.ts` : `subscribe(_prev, formData)` — parse `period` ; appelle `getPaymentProvider().checkout`
  ; si `mode === "activated"` → `supabase.rpc("mock_subscribe", { p_period })` ; (si `redirect` →
  renvoyer l'URL, branché avec Stripe plus tard) ; `revalidatePath`. `cancelSubscription(_prev, _fd)` —
  `supabase.rpc("cancel_subscription")`.
- `queries.ts` : `getSubscription()` (sa ligne ou null), `getIsPremium()` (= `isPremiumFrom(sub, new
  Date())`).
- **`src/features/voyages/data/actions.ts`** : `createVoyage` ajoute un **check proactif** avant
  l'insert — si `!isPremium` et `count(voyages owned) >= FREE_VOYAGE_LIMIT` → `return { error:
  "limit", limit: true }` (message UI « passez Premium »). Le trigger DB reste le garde autoritaire :
  si l'insert échoue malgré tout sur l'exception `limite_voyages_free`, mapper vers la même erreur.

## 7. UI

- `app/[locale]/(app)/abonnement/page.tsx` : plan courant (Free / Premium + période + date de
  renouvellement ou « premium jusqu'au {date} » si annulé), boutons **Mensuel / Annuel** (souscription
  mock), bouton **Annuler** si premium actif. `error.tsx` sur le segment.
- Composants `features/abonnement/ui/` : `PlanStatus`, `SubscribeButtons`, `CancelButton`.
  `data-testid` : `plan-actuel`, `subscribe-monthly`, `subscribe-yearly`, `cancel-sub`,
  `premium-badge`.
- **Voyages** : la liste/le formulaire affiche un CTA upgrade quand la limite Free est atteinte
  (`data-testid="voyage-limit-cta"`), lien vers `/abonnement`.

## 8. i18n

Namespace `abonnement.*` dans `messages/fr.json` (titre, Free/Premium, mensuel/annuel, prix
indicatifs, souscrire, annuler, « premium jusqu'au {date} », renouvellement, CTA limite voyages,
erreurs). Aucune chaîne en dur.

## 9. Sécurité

- **Statut premium non falsifiable** : `subscriptions` en lecture seule pour `authenticated` ;
  écritures via RPC `security definer` (`mock_subscribe`/`cancel_subscription`) ou service-role
  (webhook Stripe réel, différé). `auth.uid()` enforcé dans les RPC.
- **Gating DB-level** : trigger `BEFORE INSERT` sur `voyages` (non contournable via REST direct). Le
  check d'action n'est que pour l'UX.
- `is_premium` en `security definer` (lit `subscriptions` sans exposer les lignes d'autrui).

## 10. Tests & seed

- **Unit (Vitest, TDD)** : `isPremiumFrom` (actif ; annulé avant expiry → true ; annulé après expiry →
  false ; null → false) ; `subscribeSchema` ; mock `PaymentProvider` (renvoie `activated`).
- **Interaction avec les e2e existants (important) :** le trigger de limite s'applique à **tous** les
  inserts dans `voyages`. L'e2e C4 « créer un voyage » crée 1 voyage pour le `client` (qui possède déjà
  le voyage seed « Rome » = 1) → total 2 = pile la limite, la création reste **autorisée** (le check
  est `count >= 2` *avant* insert : 1 ≥ 2 = faux). Aucun test existant ne crée un 3e voyage `client`,
  donc C4/C5 ne sont pas cassés. Pour **ne pas** fragiliser ces tests, les nouveaux e2e d'abonnement
  n'utilisent **pas** `client`/`agence` mais des comptes dédiés.
- **Seed dev** : deux comptes démo dédiés au Chantier 6, isolés des autres tests :
  - `free@vito.test` (id `44444444-4444-4444-8444-444444444444`) — **Free**, 0 voyage (pour l'e2e
    gating).
  - `premium@vito.test` (id `55555555-5555-4555-8555-555555555555`) — **Premium** (`subscriptions`
    active, `current_period_end` futur ; pour l'e2e annulation et démo de l'état premium).
  `client`/`agence`/`admin` inchangés. (Création des comptes auth selon le mécanisme de seed existant
  des utilisateurs.)
- **e2e (Playwright)** — sur les comptes dédiés, sans mutation croisée :
  (1) **gating** (`free@vito.test`) : créer des voyages jusqu'au plafond → 3e création bloquée + CTA
  `voyage-limit-cta` visible → souscription mock (`subscribe-monthly`) → 3e création débloquée +
  `premium-badge` visible ;
  (2) **annulation** (`premium@vito.test`) : premium actif → `cancel-sub` → statut « premium jusqu'au
  {date} » affiché.
  Les deux tests opèrent sur des comptes distincts → pas de course entre tests ni avec C4/C5.
- CI : démarre déjà Supabase + applique migrations/seed ; nouveaux e2e en CI.

## 11. Arbitrages / dette signalés

- **Stripe réel** (Checkout + webhooks + reçus/factures) ; **renouvellement automatique** ; proration /
  changement de plan ; multi-niveaux (Pro/Famille) → différés.
- **Conciergerie** = Chantier **6b** (gaté par `isPremium`).
- `FREE_VOYAGE_LIMIT` dupliqué (trigger SQL + constante domain) — synchronisation manuelle documentée ;
  une source unique (paramètre en base) est différée.
- Le gating premium n'est **pas** mis dans le JWT (claim) : statut vérifié en live (la dépendance au
  temps — expiry — interdit un claim statique fiable).
