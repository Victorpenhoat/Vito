# Slice 1 — Famille migration 00019 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le schéma `family_members` + `family_documents` (documents chiffrés en colonne, RLS owner-only) via la migration 00019, sans toucher d'écran.

**Architecture:** Migration additive (2 tables + trigger updated_at + RLS owner-only + index) + régénération des types. Aucun composant/écran.

**Tech Stack:** Supabase (Postgres + RLS), TypeScript.

## Global Constraints

- Migration **additive + idempotente**, RLS owner-only (`user_id = auth.uid()` sur les 4 verbes), `anon` exclu.
- **Pas de bucket Storage** : documents chiffrés en colonne `contenu_chiffre` (standard `voyage_documents`).
- `user_id` → `public.profiles(id)`. Prochaine migration = **00019**. Types régénérés.
- Réf. spec : `docs/superpowers/specs/2026-06-26-famille-slice-1-migration-design.md` (SQL complet en §1).

---

### Task 1: Migration 00019 + types

**Files:**
- Create: `supabase/migrations/00019_famille_documents.sql`
- Modify: `src/types/database.types.ts` (régénéré)

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00019_famille_documents.sql` **exactement** comme la spec §1 (fonction
`set_updated_at` ; tables `family_members` + `family_documents` avec `contenu_chiffre text not null` ;
3 index ; 2 triggers updated_at ; RLS owner-only sur les 2 tables ; revoke anon + grant authenticated
sur les 4 verbes).

- [ ] **Step 2: Appliquer + régénérer les types + vérifier**

Run: `supabase db reset`
Then: `supabase gen types typescript --local > src/types/database.types.ts 2>/dev/null`
Then verify:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select tablename, rowsecurity from pg_tables where tablename in ('family_members','family_documents');
select indexname from pg_indexes where tablename in ('family_members','family_documents');
select tgname from pg_trigger where tgrelid in ('public.family_members'::regclass,'public.family_documents'::regclass) and not tgisinternal;
"
```
Expected: 00001→00019 appliquées ; les 2 tables avec `rowsecurity = t` ; les 3 index présents ; les 2 triggers `*_set_updated_at`. `database.types.ts` contient `family_members`/`family_documents`. (Si `psql` absent : `docker exec -i supabase_db_Vito psql -U postgres -d postgres -c "..."`.)

- [ ] **Step 3: typecheck + lint + test**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (aucun écran ; types régénérés compilent).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00019_famille_documents.sql src/types/database.types.ts
git commit -m "feat(famille): migration 00019 — family_members + family_documents (chiffrés, RLS owner-only)"
```

---

### Task 2: Non-régression + build

- [ ] **Step 1: e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e **verte** (aucun écran touché) + build OK. (Flake connu `liste_items`/anon → relancer une fois.) Un seul `db reset`.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(famille): correctifs non-régression migration" # seulement si nécessaire
```

---

## Notes d'exécution

- **Prod** : migration 00019 **additive**, à appliquer sur Resto_Hotels **avant** le merge (autorisée par le PO), via `supabase db push`.
- **Filet** : aucune table existante touchée ; e2e inchangé.
