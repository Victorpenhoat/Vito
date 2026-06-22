# Chantier 7b — Agence ↔ clients — Design

**Date :** 2026-06-22
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `chantier-7b-agence-clients`

---

## 0. Contexte

Second volet du Chantier 7 : la relation **agence ↔ clients**. Le rôle `agence` (agence de voyage)
gère un **portefeuille de clients** et peut **créer des voyages pour eux** (le voyage appartient au
client, l'agence collabore). La permission RBAC `create:voyage_pour_client` existe déjà (agence/admin)
mais n'était branchée nulle part — ce chantier la rend opérationnelle. On réutilise le modèle voyages
(C4 : owner/membre, `on_voyage_created`, helpers) et les patterns établis (helpers `security definer`,
RPC par e-mail sans énumération). Le **dépôt de documents** (vision C1) dépend du chiffrement (slice
4b, non fait) → hors périmètre.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Capacité | **Portefeuille de clients + créer des voyages pour eux.** Dépôt de documents → slice 4b. |
| Lien | **L'agence ajoute le client par e-mail** (lien direct). Consentement client différé. |
| Propriété du voyage | **Le client possède** le voyage ; l'**agence est membre collaboratif** (via RPC `security definer`). |

## 2. Interaction avec la limite Free (6a)

`creer_voyage_pour_client` insère un voyage `owner_id = client`. Le trigger `enforce_voyage_limit`
(6a) s'applique à **tous** les inserts dans `voyages` : si le client est **Free** et possède déjà
`FREE_VOYAGE_LIMIT (2)` voyages, l'insert lève `limite_voyages_free`. C'est **voulu** (le plafond est
celui du client, peu importe qui crée). L'action mappe cette exception vers un message clair
(« Le client a atteint sa limite Free »).

## 3. Modèle de données (`supabase/migrations/00014_agence_clients.sql`)

```sql
create table public.agence_clients (
  agence_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (agence_id, client_id),
  check (agence_id <> client_id)
);

create index agence_clients_client_idx on public.agence_clients (client_id);
```

### Helper `security definer` (rôle agence)

```sql
create function public.is_agence() returns boolean
  language sql security definer set search_path = '' stable as $$
  select coalesce(auth.jwt() ->> 'user_role', '') in ('agence', 'admin');
$$;
```

### RLS & grants

```sql
alter table public.agence_clients enable row level security;
-- chaque partie voit ses liens
create policy "agence_clients_select" on public.agence_clients for select
  using (agence_id = auth.uid() or client_id = auth.uid());
-- seule une agence crée ses propres liens
create policy "agence_clients_insert" on public.agence_clients for insert
  with check (agence_id = auth.uid() and public.is_agence());
-- l'une ou l'autre partie peut rompre le lien
create policy "agence_clients_delete" on public.agence_clients for delete
  using (agence_id = auth.uid() or client_id = auth.uid());
grant select, insert, update, delete on public.agence_clients to authenticated;
revoke execute on function public.is_agence() from anon, public;
grant execute on function public.is_agence() to authenticated;
```

## 4. RPC `security definer`

```sql
-- L'agence relie un client par e-mail (sans énumération)
create function public.lier_client(p_email text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_agence() then raise exception 'réservé aux agences'; end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'not_found'; end if;
  if v_uid = auth.uid() then return 'self'; end if;
  insert into public.agence_clients (agence_id, client_id) values (auth.uid(), v_uid)
  on conflict (agence_id, client_id) do nothing;
  return 'ok';
end;
$$;

create function public.delier_client(p_client_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  delete from public.agence_clients where agence_id = auth.uid() and client_id = p_client_id;
end;
$$;

-- L'agence crée un voyage POUR un client lié (le client possède, l'agence collabore)
create function public.creer_voyage_pour_client(
  p_client_id uuid, p_titre text, p_destination text, p_date_debut date, p_date_fin date, p_statut public.voyage_statut
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentification requise'; end if;
  if not public.is_agence() then raise exception 'réservé aux agences'; end if;
  if not exists (select 1 from public.agence_clients where agence_id = auth.uid() and client_id = p_client_id) then
    raise exception 'client non lié';
  end if;
  -- owner = client ; le trigger on_voyage_created insère le client comme owner-membre ;
  -- la limite Free du client (enforce_voyage_limit) s'applique et peut lever limite_voyages_free.
  insert into public.voyages (owner_id, titre, destination, date_debut, date_fin, statut)
  values (p_client_id, p_titre, nullif(p_destination, ''), p_date_debut, p_date_fin, coalesce(p_statut, 'planifie'))
  returning id into v_id;
  -- l'agence devient membre collaboratif
  insert into public.voyage_membres (voyage_id, profile_id, role) values (v_id, auth.uid(), 'membre')
  on conflict (voyage_id, profile_id) do nothing;
  return v_id;
end;
$$;

revoke execute on function public.lier_client(text) from anon, public;
grant execute on function public.lier_client(text) to authenticated;
revoke execute on function public.delier_client(uuid) from anon, public;
grant execute on function public.delier_client(uuid) to authenticated;
revoke execute on function public.creer_voyage_pour_client(uuid, text, text, date, date, public.voyage_statut) from anon, public;
grant execute on function public.creer_voyage_pour_client(uuid, text, text, date, date, public.voyage_statut) to authenticated;
```
(Note : `creer_voyage_pour_client` est `security definer` → elle insère un voyage `owner_id = client`
malgré la policy `voyages_insert` (owner = auth.uid). La vérif du lien + du rôle agence dans la RPC
est la frontière d'autorisation.)

## 5. Logique métier (pure, testée — `features/agence/domain/`)

- `schemas.ts` : `lierClientSchema` (`email`) ; réutilise `voyageInputSchema` (C4) + `clientId` (uuid)
  pour le formulaire de création de voyage (`voyagePourClientSchema = voyageInputSchema.and(z.object({
  clientId: z.string().uuid() }))` ou un schéma dédié reprenant les champs).

## 6. Données / actions (`features/agence/data/`)

- `actions.ts` : `lierClient` (RPC `lier_client` ; mappe `not_found`/`self`), `delierClient`,
  `creerVoyagePourClient` (parse voyage + clientId ; RPC `creer_voyage_pour_client` ; mappe
  `client non lié` et `limite_voyages_free` → messages). `agence_id`/membre de la session.
- `queries.ts` : `getMesClients()` (clients de l'agence + `display_name`).

## 7. UI (`/agence` + `features/agence/ui/`)

- `app/[locale]/(app)/agence/page.tsx` : **réservée agence/admin** — garde `getSessionRole()` ; si
  rôle non autorisé → `redirect` vers `/restos`. Contenu : `ClientsList` (portefeuille) + `LierClientForm`
  (ajouter par e-mail) ; par client, un `VoyagePourClientForm` (titre/destination/dates/statut) →
  crée le voyage. `error.tsx` sur le segment.
- Composants : `ClientsList`, `LierClientForm`, `VoyagePourClientForm`. `data-testid` :
  `lier-client-form`, `client-row`, `voyage-client-form`.
- Le voyage créé apparaît dans `/voyages` du client (owner) **et** de l'agence (membre).

## 8. i18n

Namespace `agence.*` dans `messages/fr.json` (titre, portefeuille, ajouter un client/e-mail, retirer,
créer un voyage, champs voyage, messages `not_found`/`self`/`client non lié`/limite, vide, erreurs).
Aucune chaîne en dur.

## 9. Sécurité

- `/agence` et les RPC réservés aux rôles `agence`/`admin` (`is_agence` côté DB + garde de rôle côté
  page). `lier_client` sans énumération d'e-mails.
- `creer_voyage_pour_client` vérifie le **lien agence↔client** : une agence ne peut pas créer un voyage
  pour quelqu'un qui n'est pas son client. `owner_id` (= client) et le membre agence sont posés côté
  serveur. La **limite Free du client** (trigger 6a) est respectée.
- RLS sur `agence_clients` ; `is_agence` `security definer` revoke anon/public.

## 10. Tests & seed

- **Unit (Vitest, TDD)** : `lierClientSchema` (email valide/invalide).
- **Seed dev** : un **client dédié Free, 0 voyage** : `client7b@vito.test` (id
  `99999999-9999-4999-8999-999999999999`). L'agence = `agence@vito.test` (rôle `agence` déjà attribué
  au seed). **Aucun lien** agence↔client pré-créé. (Client dédié pour rester sous la limite Free et ne
  pas heurter les e2e voyages existants.)
- **e2e (Playwright)** — 2 contextes / comptes ciblés :
  (1) `agence@vito.test` → `/agence` → relie `client7b@vito.test` (par e-mail) → le portefeuille
  affiche le client → crée un voyage pour lui → un 2ᵉ contexte (`client7b`) voit le voyage dans
  « Mes voyages » (il en est owner) ;
  (2) **gating** : `client7b@vito.test` (rôle client) ouvre `/agence` → accès refusé (redirigé hors de
  `/agence`). Signaux déterministes.

## 11. Arbitrages / dette signalés

- **Dépôt de documents** pour les clients → slice 4b (chiffrement AES-256-GCM, clé hors DB).
- Invitation **avec consentement** du client → différée (ajout direct).
- Vue agence regroupant les voyages par client ; édition riche ; facturation B2B → différées.
- L'agence créant un voyage pour un client **Free au plafond** est bloquée (limite du client) — par
  design ; message clair côté action.
