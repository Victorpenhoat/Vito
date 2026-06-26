# Slice 1 (épic Famille documents) — Migration 00019 — Design

**Date :** 2026-06-26
**Statut :** À valider (PO). Plan ensuite.
**Branche :** `famille-migration`
**Directive :** `docs/design/famille-documents-epic-directive.md`

---

## 0. Contexte

Première slice de l'épic « Famille proches + pièces d'identité ». Pose le **schéma** : répertoire de
proches (`family_members`) + leurs documents d'identité **chiffrés au repos** (`family_documents`,
colonne `contenu_chiffre` — PAS de bucket, conforme au standard Vito des `voyage_documents`). RLS
**owner-only** (répertoire privé). Aucun écran encore.

## 1. Migration `supabase/migrations/00019_famille_documents.sql`

```sql
-- Fonction trigger updated_at générique (réutilisable)
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Répertoire de proches (privé : owner-only)
create table public.family_members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  first_name   text not null check (char_length(first_name) between 1 and 120),
  last_name    text not null check (char_length(last_name) between 1 and 120),
  relation     text not null check (relation in ('conjoint','enfant','parent','beau_parent','ami','autre')),
  circle       text not null default 'proche' check (circle in ('proche','elargie','amis')),
  phone        text,
  email        text,
  birth_date   date,
  avatar_color text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Documents rattachés (octets CHIFFRÉS en colonne — pas de bucket)
create table public.family_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  member_id     uuid not null references public.family_members (id) on delete cascade,
  doc_type      text not null check (doc_type in
                  ('passeport','carte_identite','permis_conduire','permis_bateau','visa','titre_sejour','autre')),
  doc_number    text,
  country       text,
  holder_name   text,
  issue_date    date,
  expiry_date   date,
  issue_place   text,
  contenu_chiffre text not null,      -- base64 du blob AES-256-GCM (encryptDocument)
  mime_type     text not null,
  taille        integer not null,
  ocr_raw       jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index family_members_user_idx on public.family_members (user_id);
create index family_documents_user_member_idx on public.family_documents (user_id, member_id);
create index family_documents_expiry_idx on public.family_documents (expiry_date);

create trigger family_members_set_updated_at before update on public.family_members
  for each row execute function public.set_updated_at();
create trigger family_documents_set_updated_at before update on public.family_documents
  for each row execute function public.set_updated_at();

-- RLS owner-only (répertoire privé)
alter table public.family_members enable row level security;
alter table public.family_documents enable row level security;

create policy "family_members_owner" on public.family_members
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "family_documents_owner" on public.family_documents
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants explicites (anon exclu)
revoke all on public.family_members from anon;
revoke all on public.family_documents from anon;
grant select, insert, update, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.family_documents to authenticated;
```

## 2. Conventions / cohérence

- `user_id` → `public.profiles(id)` (= `auth.uid()`), comme `liste_items`/`vins`. RLS owner-only sur
  les 4 verbes. `member_id` `on delete cascade` → supprimer un proche supprime ses documents (octets
  chiffrés en colonne → cascade SQL suffit, **aucun bucket à nettoyer**).
- **Pas de `storage_path` / bucket / policy Storage** (le brief est remplacé par le stockage chiffré
  en colonne `contenu_chiffre`, standard `voyage_documents`).
- `taille` / `mime_type` pour la validation et l'affichage ; `ocr_raw` pour l'audit de la lecture auto.

## 3. Sécurité

- RLS owner-only ; grants explicites, `anon` exclu. Octets chiffrés (déchiffrement serveur uniquement
  dans les slices suivantes). Migration **additive**, aucune donnée touchée.

## 4. Tests

- **Migration** : `supabase db reset` applique 00001→00019 ; vérifier l'existence des tables + RLS
  activée + les 3 index + le trigger `set_updated_at`. (Pas de seed nécessaire à ce stade.)
- **Types** : `supabase gen types typescript --local > src/types/database.types.ts` ; `family_members`
  /`family_documents` présents. typecheck+lint+test verts.
- e2e inchangés (aucun écran). Build OK.

## 5. Prod

- Migration 00019 **additive** → appliquée sur Resto_Hotels **avant** le merge (autorisation PO au
  moment du « go prod »), comme 00017/00018.

## 6. Arbitrages / dette

- `DOCUMENTS_ENCRYPTION_KEY` déjà en prod (utilisée par les documents de voyage) → réutilisée, rien à
  provisionner.
- Pas de contrainte d'unicité sur (member_id, doc_type) : un proche peut avoir plusieurs documents du
  même type (ancien + nouveau passeport) — voulu.
