# Chantier 2 — Module Vins — Design

**Date :** 2026-06-21
**Statut :** Validé (design). Implémentation à découper dans un plan dédié.
**Branche :** `chantier-2-vins`

---

## 0. Contexte

Deuxième chantier de Vito, branché sur le module Restos existant (Chantier 1). On respecte
l'architecture en place : couches `features/<module>/{domain,data,ui}`, abstractions de services
sous `lib/services/<provider>/`, RLS partout + grants explicites, types dérivés du schéma DB,
TDD sur la logique métier, e2e sur le parcours. Diagnostic-first, un slice vertical testé.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Structure des données | **`vins` (par utilisateur) + `degustations`** (normalisé, owner-only). |
| Enrichissement / normalisation | **Abstraction `EnrichmentProvider` + adapter mock (no-op)** ; saisie 100 % manuelle ce chantier, **zéro coût**. Adapter LLM/API codé et prêt, activé plus tard. |
| Abstraction marchand | Interface `MerchantProvider` + `MockMerchantProvider` (URL placeholder, **pas d'affiliation**) ; partenaire réel branché plus tard. |

### Pourquoi le modèle normalisé (justification demandée)
Séparer l'**identité du vin** (intrinsèque : nom, domaine, millésime, région, couleur, cépages)
de la **dégustation** (contextuelle : où, quand, note, prix payé) :
- évite la duplication des métadonnées quand le même vin est bu plusieurs fois ;
- donne l'onglet « Mes vins » consolidé (une ligne par vin) avec des stats (nb de dégustations,
  dernière fois, dernier resto, note) ;
- permet le dédoublonnage dans la cave de l'utilisateur ;
- garde une RLS simple (owner-only sur les deux tables), comme `avis`.

La note et le prix vivent sur la **dégustation** (on note en contexte) ; l'onglet agrège.
Le modèle plat (une ligne par dégustation) est rejeté : il duplique les métadonnées et perd la
notion de « vin consolidé » voulue dans l'onglet. Le `vins` partagé/global est rejeté pour ce
chantier (résolution d'identité des noms libres complexe et risquée) ; un chemin de migration vers
une table canonique partagée reste possible si la reco inter-utilisateurs le justifie plus tard.

## 2. Modèle de données (`supabase/migrations/00006_vins.sql`)

```sql
create type public.vin_couleur as enum ('rouge', 'blanc', 'rose', 'petillant', 'autre');

create table public.vins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  nom text not null check (char_length(nom) <= 200),
  domaine text check (domaine is null or char_length(domaine) <= 200),
  millesime smallint check (millesime is null or (millesime between 1900 and 2100)),
  region text,
  couleur public.vin_couleur,
  cepages text[] not null default '{}',
  achat_url text,                       -- override manuel optionnel du lien d'achat
  created_at timestamptz not null default now()
);
-- Dédoublonnage par cave : un même (nom, millésime, domaine) normalisé = un seul vin.
create unique index vins_dedup_uidx on public.vins
  (user_id, lower(nom), coalesce(millesime, 0), lower(coalesce(domaine, '')));

create table public.degustations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  vin_id uuid not null references public.vins (id) on delete cascade,
  etablissement_id uuid references public.etablissements (id) on delete set null,
  avis_id uuid references public.avis (id) on delete set null,
  deguste_le date not null default current_date,
  note smallint check (note is null or note between 1 and 5),
  prix_paye numeric(10, 2) check (prix_paye is null or prix_paye >= 0),
  commentaire text,
  created_at timestamptz not null default now()
);

-- RLS owner-only sur les deux tables
alter table public.vins enable row level security;
create policy "vins_all_owner" on public.vins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.degustations enable row level security;
create policy "degustations_all_owner" on public.degustations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants explicites (leçon de 00005 : la RLS ne suffit pas pour PostgREST)
grant select, insert, update, delete on public.vins to authenticated;
grant select, insert, update, delete on public.degustations to authenticated;

-- Index de filtre/jointure
create index degustations_user_idx on public.degustations (user_id);
create index degustations_vin_idx on public.degustations (vin_id);
create index degustations_etab_idx on public.degustations (etablissement_id);
create index degustations_date_idx on public.degustations (deguste_le);
create index vins_user_idx on public.vins (user_id);
```

`etablissement_id`/`avis_id` en `on delete set null` : une dégustation survit à la suppression du
resto ou de l'avis associé.

## 3. Flux de capture (depuis la fiche resto)

Sur `FicheResto`, un bloc « Vins dégustés ici » + un `DegustationForm` (client component).
Server action `addDegustation` :
1. Validation Zod des entrées (champs vin + dégustation).
2. `getUser()` (rejet si non authentifié) — `user_id` vient de la session, jamais du client.
3. `EnrichmentProvider.normalize(input)` (mock no-op) avant persistance.
4. **find-or-create** du `vin` pour cet utilisateur (dédoublonnage via la clé normalisée :
   `upsert ... on conflict (l'index unique) do update`/`do nothing` puis `select`).
5. Insert de la `degustation` (`vin_id`, `etablissement_id` = la fiche courante, `deguste_le`,
   `note`, `prix_paye`, `commentaire`, `avis_id` optionnel).
6. `revalidatePath` des routes concernées.

Même structure que `addResto`/`addAvis`. Renvoie `{ error }` en cas d'échec (pas de throw brut).

## 4. Onglet « Mes vins » + filtres

- `(app)/vins/page.tsx` : liste consolidée des `vins` de l'utilisateur avec agrégats issus de
  `degustations` (nb dégustations, dernière date, dernière/meilleure note, dernier resto).
- **Filtres serveur** : couleur (enum), région (texte), note (min), resto (`etablissement_id`),
  plage de dates — appliqués via la jointure `degustations`.
- `(app)/vins/[id]/page.tsx` : détail d'un vin → ses dégustations + lien d'achat (cf. §5).
- `(app)/vins/error.tsx` : error boundary du segment (les lectures peuvent throw).
- `data/queries.ts` : `getMesVins(filters)`, `getVinDetail(id)`. `data/actions.ts` : `addDegustation`,
  + édition/suppression d'une dégustation (CRUD owner, RLS).

## 5. Abstraction marchand (`lib/services/merchant/`)

Même forme que `lib/services/places/` :
```ts
type VinAchat = { nom: string; domaine: string | null; millesime: number | null; couleur: string | null };
interface MerchantProvider {
  readonly name: string;
  buyUrl(vin: VinAchat, quantity: number): string | null;
}
```
- `mock.ts` : `MockMerchantProvider` → URL de recherche placeholder déterministe (ex.
  `https://marchand.example/search?q=<nom millesime>&qty=N`), **aucune affiliation ni revenu**.
- `index.ts` : `getMerchantProvider()` → réel si une variable d'env marchand est définie, sinon mock.
- UI : bouton « Acheter » + sélecteur de quantité sur le détail vin → `buyUrl(n)` (ouvre un onglet).
  Si `vins.achat_url` est renseigné manuellement, il **prime** sur le provider.

## 6. Sécurité

- RLS owner-only sur `vins` + `degustations` ; **grants explicites** posés dès la migration.
- `user_id` toujours dérivé de la session côté serveur (jamais du client). Aucune utilisation du
  client service-role dans la couche données.
- Validation Zod en amont de toute écriture (le serveur fait foi).

## 7. i18n

Tout texte visible via `next-intl` ; ajout d'un namespace `vins.*` dans `messages/fr.json`
(titres, libellés couleurs, libellés filtres, boutons, placeholders).

## 8. Tests

- **Unit (Vitest, TDD)** : normalisation (mock enrichment), construction de la clé de
  dédoublonnage, `buyUrl` du marchand, schémas Zod, mapping filtres → requête.
- **e2e (Playwright)** : depuis une fiche resto → capturer un vin dégusté → il apparaît dans
  « Mes vins » → filtre par couleur → le lien d'achat est présent sur le détail.
- **Seed dev** : 1 vin + 1 dégustation de démo pour le compte client (rattachés au resto démo),
  via un UUID v4 valide (leçon Chantier 1).
- CI : la pipeline démarre déjà Supabase + applique migrations/seed ; les nouveaux e2e tournent en CI.

## 9. Arbitrages / dette signalés

- **Enrichissement** : mock no-op → vins 100 % manuels ; LLM (Anthropic) / API vin différé (coût) —
  interface `EnrichmentProvider` codée et prête.
- **Marchand** : mock (URL placeholder, pas d'affiliation) → partenaire réel + ToS à brancher plus tard.
- **Dédoublonnage** : best-effort sur noms libres (« Ch. Margaux » ≠ « Château Margaux ») — acceptable.
- **`vins` par utilisateur** : migration possible vers une table canonique partagée si la reco
  inter-utilisateurs (Chantier 3+) le justifie.
- **`/api` marchand** : pas de route serveur dédiée ce chantier (le `buyUrl` est un lien sortant,
  pas un proxy de bytes — contrairement aux photos Places).
