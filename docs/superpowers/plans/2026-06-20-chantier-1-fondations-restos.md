# Chantier 1 — Fondations + Module Restos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les fondations production-grade (scaffold Next.js/Supabase/PWA/CI) + le module Restos de bout en bout (ajout avec pré-remplissage, tags, favoris, fiche enrichie, avis perso), testé et sécurisé par RLS.

**Architecture:** Next.js App Router (Server Components + Server Actions) en couches strictes `app/` (pages) → `features/` (métier) → `lib/` (infra). Supabase Postgres local (CLI/Docker) avec RLS sur chaque table, RBAC via claim JWT injecté par un Custom Access Token Hook, écriture du référentiel via RPC `security definer`. Enrichissement restos derrière une abstraction `PlacesProvider` (adapter mock en dev, adapter Google Places prêt). Photos servies à la volée via un proxy (jamais stockées).

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Tailwind, `next-intl`, `@supabase/ssr`, Supabase CLI, Zod, Vitest, Playwright, GitHub Actions, PWA (manifest + service worker).

## Global Constraints

- TypeScript strict : `"strict": true`, `"noUncheckedIndexedAccess": true`. **Aucun `any`.**
- **RLS activée sur CHAQUE table dès sa création.** Aucune exception.
- Le schéma DB est la **source de vérité des types** : tous les types DB proviennent de `src/types/database.types.ts` généré par `supabase gen types`. Jamais réécrits à la main.
- **Aucune logique métier dans les composants** : elle vit dans `features/<module>/domain` (pur) et `features/<module>/data` (accès données).
- Le **serveur fait foi** : toute écriture sensible passe par Server Action validée Zod + RLS. L'UI ne fait jamais autorité.
- **Pas de dette** : pas de TODO en prod, pas de contournement « temporaire » non signalé.
- **Conformité Places** : on stocke le `place_id`, **jamais les photos** ; photos servies à la volée par proxy.
- i18n : tout texte visible passe par `next-intl` (`messages/fr.json`). Pas de chaîne en dur dans les composants.
- Secrets jamais inventés : la clé Google Places et la clé Anthropic sont fournies par l'utilisateur via `.env.local` ; en leur absence, les adapters mock/fallback sont utilisés.
- Commits fréquents, un par tâche minimum, message en français, suffixe `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Structure des fichiers (décomposition)

```
supabase/
  config.toml                       # auth hook activé, storage
  migrations/
    00001_init_profiles_rbac.sql    # app_role, profiles, trigger handle_new_user, RLS
    00002_access_token_hook.sql      # custom_access_token_hook + grants
    00003_restos.sql                 # etablissements, tags, liste_items, liste_item_tags, avis, RLS, RPC
  seed.sql                          # 3 comptes, tags système, restos démo
src/
  types/database.types.ts           # GÉNÉRÉ
  lib/
    env.ts                          # parsing/validation env (Zod), typé
    supabase/
      client.ts                     # createBrowserClient
      server.ts                     # createServerClient (cookies)
      admin.ts                      # service-role client (server-only)
    rbac/
      roles.ts                      # type AppRole, permissions, helpers can()
      guards.ts                     # requireRole / getSessionRole (server)
    services/places/
      types.ts                      # PlaceResult, PlacesProvider interface
      mock.ts                       # MockPlacesProvider
      google.ts                     # GooglePlacesProvider
      index.ts                      # getPlacesProvider() (sélection par env)
    services/llm/
      classifier.ts                 # classifyEtablissement (LLM optionnel + fallback)
    i18n/
      routing.ts, request.ts        # config next-intl
  features/restos/
    domain/
      mapPlaceToEtablissement.ts    # PlaceResult -> EtablissementInput (pur)
      classifyFallback.ts           # type d'établissement sans LLM (pur)
      schemas.ts                    # schémas Zod des entrées
    data/
      actions.ts                    # Server Actions (addResto, toggleFavorite, addAvis, setTags)
      queries.ts                    # lectures (ma liste, fiche)
    ui/
      RestoSearch.tsx, RestoCard.tsx, RestoForm.tsx, FicheResto.tsx, AvisForm.tsx, TagPicker.tsx
  app/
    [locale]/
      layout.tsx, (auth)/login/page.tsx, (auth)/signup/page.tsx
      (app)/layout.tsx, (app)/restos/page.tsx, (app)/restos/[id]/page.tsx
    api/places/photo/route.ts       # proxy photo (à la volée)
  middleware.ts                     # session + locale
messages/fr.json
public/manifest.webmanifest, public/sw.js
e2e/restos.spec.ts
.github/workflows/ci.yml
```

---

# PHASE A — Scaffold & fondations

### Task 1: Scaffold Next.js + TypeScript strict + Tailwind

**Files:**
- Create: project files via `create-next-app`
- Modify: `tsconfig.json`, `package.json`

**Interfaces:**
- Produces: un projet Next.js App Router exécutable (`npm run dev`), `src/` activé, alias `@/*`.

- [ ] **Step 1: Scaffolder dans le repo existant**

Le repo contient déjà `.git` et `readme.md`. Scaffolder dans un dossier temporaire puis fusionner évite l'échec « directory not empty ».

```bash
cd /Users/victorpenhoat/IdeaProjects/Vito
npx create-next-app@latest .vito-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
# Fusion dans le repo courant (préserve .git et readme.md)
rsync -a --exclude='.git' .vito-scaffold/ ./
rm -rf .vito-scaffold
```

- [ ] **Step 2: Durcir TypeScript**

Dans `tsconfig.json`, sous `compilerOptions`, garantir :

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": false
  }
}
```

- [ ] **Step 3: Vérifier le build de base**

Run: `npm run lint && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js App Router + TS strict + Tailwind"
```

---

### Task 2: i18n (next-intl) avec routing `[locale]`

**Files:**
- Create: `src/lib/i18n/routing.ts`, `src/lib/i18n/request.ts`, `messages/fr.json`
- Modify: `next.config.ts`, déplacer l'arbre `app/` sous `app/[locale]/`

**Interfaces:**
- Produces: `routing` (locales `['fr']`, défaut `fr`), `Link`/`redirect` localisés, fonction `getTranslations` utilisable côté serveur.

- [ ] **Step 1: Installer next-intl**

```bash
npm install next-intl
```

- [ ] **Step 2: Config de routing**

`src/lib/i18n/routing.ts` :

```ts
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["fr"],
  defaultLocale: "fr",
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 3: Request config + plugin**

`src/lib/i18n/request.ts` :

```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as "fr")
    ? (requested as "fr")
    : routing.defaultLocale;
  return { locale, messages: (await import(`../../../messages/${locale}.json`)).default };
});
```

`next.config.ts` :

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");
const nextConfig: NextConfig = {};
export default withNextIntl(nextConfig);
```

- [ ] **Step 4: Messages initiaux**

`messages/fr.json` :

```json
{
  "app": { "name": "Vito" },
  "auth": {
    "login": "Connexion",
    "signup": "Créer un compte",
    "email": "E-mail",
    "password": "Mot de passe",
    "submit": "Valider"
  },
  "restos": {
    "title": "Mes restos",
    "add": "Ajouter un resto",
    "search": "Rechercher un établissement",
    "favorite": "Favori",
    "statut": { "a_faire": "À faire", "visite": "Visité" },
    "avis": "Mes avis",
    "addAvis": "Ajouter un avis"
  }
}
```

- [ ] **Step 5: Déplacer l'arbre sous `[locale]` + layout**

Déplacer `src/app/page.tsx` et `src/app/layout.tsx` sous `src/app/[locale]/`. Le `layout.tsx` localisé :

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Déplacer `globals.css` en `src/app/globals.css` (import relatif ci-dessus).

- [ ] **Step 6: Vérifier**

Run: `npm run dev` puis ouvrir `http://localhost:3000/fr`
Expected: la home s'affiche sous `/fr`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: i18n next-intl + routing [locale] (fr)"
```

---

### Task 3: Middleware (locale ; session ajoutée en Task 12)

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Produces: middleware next-intl actif. Sera étendu pour le refresh de session Supabase en Task 12.

- [ ] **Step 1: Middleware locale**

`src/middleware.ts` :

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 2: Vérifier la redirection racine**

Run: `npm run dev` puis ouvrir `http://localhost:3000/`
Expected: redirection vers `/fr`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: middleware i18n (redirection locale)"
```

---

### Task 4: PWA (manifest + service worker installable)

**Files:**
- Create: `public/manifest.webmanifest`, `public/sw.js`, `src/app/[locale]/pwa-register.tsx`
- Modify: `src/app/[locale]/layout.tsx`

**Interfaces:**
- Produces: app installable (manifest lié, SW enregistré côté client).

- [ ] **Step 1: Manifest**

`public/manifest.webmanifest` :

```json
{
  "name": "Vito",
  "short_name": "Vito",
  "start_url": "/fr",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111111",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Générer deux icônes PNG placeholder (`public/icon-192.png`, `public/icon-512.png`) :

```bash
# Carrés unis, suffisants pour l'installabilité en dev
printf '' >/dev/null
node -e "const f=require('fs');const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');f.writeFileSync('public/icon-192.png',b);f.writeFileSync('public/icon-512.png',b);"
```

- [ ] **Step 2: Service worker minimal (offline shell)**

`public/sw.js` :

```js
const CACHE = "vito-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/fr"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r ?? caches.match("/fr")))
  );
});
```

- [ ] **Step 3: Enregistrement du SW (client component)**

`src/app/[locale]/pwa-register.tsx` :

```tsx
"use client";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
```

- [ ] **Step 4: Lier manifest + register dans le layout**

Dans `src/app/[locale]/layout.tsx`, ajouter l'export `metadata` et monter `<PwaRegister />` dans le `<body>` :

```tsx
import { PwaRegister } from "./pwa-register";

export const metadata = {
  manifest: "/manifest.webmanifest",
  themeColor: "#111111",
};
// ... dans <body> : <PwaRegister />{children}
```

- [ ] **Step 5: Vérifier**

Run: `npm run build && npm run start` puis DevTools → Application → Manifest
Expected: manifest détecté, SW enregistré, app installable.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: PWA installable (manifest + service worker)"
```

---

### Task 5: Outils de test (Vitest + Playwright)

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`, `playwright.config.ts`, `e2e/.gitkeep`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `npm run test` (Vitest), `npm run test:e2e` (Playwright). Consommés par la CI (Task 6).

- [ ] **Step 1: Installer**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Config Vitest**

`vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

`src/test/setup.ts` :

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Config Playwright**

`playwright.config.ts` :

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/fr",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Scripts package.json**

Ajouter à `scripts` :

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 5: Test sanity**

`src/test/sanity.test.ts` :

```ts
import { describe, it, expect } from "vitest";
describe("sanity", () => {
  it("additionne", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm run test`
Expected: 1 test passé.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: outils de test Vitest + Playwright"
```

---

### Task 6: CI bloquante (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: pipeline `typecheck → lint → unit → e2e` bloquant sur PR et `main`.

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml` :

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24", cache: "npm" }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Vérifier la syntaxe localement (act non requis)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: succès (équivalent aux 3 premières étapes CI).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "ci: pipeline bloquant typecheck/lint/unit/e2e"
```

---

# PHASE B — Données & sécurité

### Task 7: Supabase local + migration 00001 (profiles + RBAC)

**Files:**
- Create: `supabase/config.toml` (via init), `supabase/migrations/00001_init_profiles_rbac.sql`
- Modify: `.gitignore` (si besoin), `.env.local` (clés locales)

**Interfaces:**
- Produces: enum `app_role`, table `public.profiles` (avec RLS), trigger `handle_new_user` qui crée un profil à l'inscription. Consommé par toutes les tables perso.

- [ ] **Step 1: Init Supabase**

```bash
supabase init
supabase start
```

`supabase start` imprime `API URL`, `anon key`, `service_role key`. Les copier dans `.env.local` (Task 11).

- [ ] **Step 2: Migration init**

`supabase/migrations/00001_init_profiles_rbac.sql` :

```sql
-- Rôles RBAC explicites, extensibles
create type public.app_role as enum ('client', 'agence', 'admin');

-- Profil 1:1 avec auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'client',
  display_name text,
  locale text not null default 'fr',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lecture/écriture de son propre profil ; admin lit tout (claim JWT, voir 00002)
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (
    id = auth.uid()
    or coalesce(auth.jwt() ->> 'user_role', '') = 'admin'
  );

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Création automatique du profil à l'inscription
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> Note : `role` provient des `user_meta_data` au seed (admin/agence). En production, le rôle ne doit jamais être auto-attribué par un utilisateur final — un signup public force `client`. Voir Task 13 (le signup public ne transmet pas `role`).

- [ ] **Step 3: Appliquer**

```bash
supabase migration up
```

Expected: migration appliquée sans erreur.

- [ ] **Step 4: Vérifier RLS active**

```bash
supabase db lint
```

Expected: aucune table sans RLS signalée.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(db): profiles + enum app_role + trigger handle_new_user (RLS)"
```

---

### Task 8: Migration 00002 — Custom Access Token Hook (rôle dans le JWT)

**Files:**
- Create: `supabase/migrations/00002_access_token_hook.sql`
- Modify: `supabase/config.toml`

**Interfaces:**
- Produces: claim `user_role` présent dans tous les JWT. Consommé par les policies RLS (`auth.jwt() ->> 'user_role'`) et `lib/rbac/guards`.

- [ ] **Step 1: Fonction hook**

`supabase/migrations/00002_access_token_hook.sql` :

```sql
-- Injecte le rôle du profil dans le JWT (claim user_role)
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = (event ->> 'user_id')::uuid;
  claims := event -> 'claims';
  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role::text));
  else
    claims := jsonb_set(claims, '{user_role}', '"client"');
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- L'auth admin doit pouvoir exécuter le hook et lire les profils
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Policy permettant à l'auth admin de lire les profils pour le hook
create policy "profiles_select_auth_admin" on public.profiles
  for select to supabase_auth_admin using (true);
```

- [ ] **Step 2: Activer le hook dans config.toml**

Dans `supabase/config.toml`, ajouter :

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

- [ ] **Step 3: Appliquer + redémarrer pour charger le hook**

```bash
supabase migration up
supabase stop && supabase start
```

- [ ] **Step 4: Vérifier le claim (après seed en Task 10, re-vérifier)**

Pour l'instant, vérifier que la fonction existe :

```bash
supabase db lint
```

Expected: pas d'erreur. (La présence du claim sera vérifiée e2e en Task 14.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(db): custom access token hook (rôle -> claim JWT user_role)"
```

---

### Task 9: Migration 00003 — schéma Restos + RLS + RPC d'upsert

**Files:**
- Create: `supabase/migrations/00003_restos.sql`

**Interfaces:**
- Produces:
  - tables `etablissements`, `tags`, `liste_items`, `liste_item_tags`, `avis`
  - RPC `public.upsert_etablissement(p jsonb) returns uuid` (`security definer`) — seul moyen d'écrire dans `etablissements`.
  - Signature RPC consommée par `features/restos/data/actions.ts` (Task 17).

- [ ] **Step 1: Migration restos**

`supabase/migrations/00003_restos.sql` :

```sql
-- Référentiel partagé des établissements (lecture seule pour les clients)
create type public.etablissement_categorie as enum ('resto', 'hotel');

create table public.etablissements (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,
  categorie public.etablissement_categorie not null default 'resto',
  type text,                         -- étoilé / bistrot / brasserie… (classification)
  nom text not null,
  adresse text,
  ville text,
  code_postal text,
  arrondissement text,
  lat double precision,
  lng double precision,
  telephone text,
  website text,
  price_level smallint,
  source text not null default 'manual',
  enriched_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.etablissements enable row level security;

-- Lecture pour tout authentifié ; AUCUNE écriture directe (passe par la RPC)
create policy "etab_select_authenticated" on public.etablissements
  for select to authenticated using (true);

-- Taxonomie de tags (ambiance…), extensible
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  categorie text not null default 'ambiance',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;
create policy "tags_select_authenticated" on public.tags
  for select to authenticated using (true);

-- Relation perso user <-> établissement (liste « à faire » + favoris fusionnés)
create type public.liste_statut as enum ('a_faire', 'visite');

create table public.liste_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  statut public.liste_statut not null default 'a_faire',
  is_favorite boolean not null default false,
  montant_par_personne numeric(10, 2),
  added_at timestamptz not null default now(),
  unique (user_id, etablissement_id)
);

alter table public.liste_items enable row level security;
create policy "liste_items_all_owner" on public.liste_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tags appliqués par l'utilisateur sur son item (classification perso)
create table public.liste_item_tags (
  liste_item_id uuid not null references public.liste_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (liste_item_id, tag_id)
);

alter table public.liste_item_tags enable row level security;
-- L'ownership dérive du liste_item parent
create policy "liste_item_tags_all_owner" on public.liste_item_tags
  for all using (
    exists (
      select 1 from public.liste_items li
      where li.id = liste_item_id and li.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.liste_items li
      where li.id = liste_item_id and li.user_id = auth.uid()
    )
  );

-- Avis perso libres, plusieurs par établissement
create table public.avis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  note smallint check (note between 1 and 5),
  commentaire text,
  visite_le date,
  created_at timestamptz not null default now()
);

alter table public.avis enable row level security;
create policy "avis_all_owner" on public.avis
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RPC contrôlée : seul moyen d'écrire dans etablissements.
-- Upsert par place_id si fourni, sinon insert. Retourne l'id.
create function public.upsert_etablissement(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_place_id text := nullif(p ->> 'place_id', '');
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  if v_place_id is not null then
    select id into v_id from public.etablissements where place_id = v_place_id;
  end if;

  if v_id is null then
    insert into public.etablissements
      (place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement,
       lat, lng, telephone, website, price_level, source, enriched_at)
    values (
      v_place_id,
      coalesce((p ->> 'categorie')::public.etablissement_categorie, 'resto'),
      p ->> 'type',
      p ->> 'nom',
      p ->> 'adresse',
      p ->> 'ville',
      p ->> 'code_postal',
      p ->> 'arrondissement',
      (p ->> 'lat')::double precision,
      (p ->> 'lng')::double precision,
      p ->> 'telephone',
      p ->> 'website',
      (p ->> 'price_level')::smallint,
      coalesce(p ->> 'source', 'places'),
      case when p ? 'enriched_at' then (p ->> 'enriched_at')::timestamptz else null end
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.upsert_etablissement(jsonb) from anon;
grant execute on function public.upsert_etablissement(jsonb) to authenticated;
```

- [ ] **Step 2: Appliquer + lint**

```bash
supabase migration up
supabase db lint
```

Expected: aucune table sans RLS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): schéma restos (etablissements/tags/liste_items/avis) + RLS + RPC upsert"
```

---

### Task 10: Seed (3 comptes + tags + restos démo) + génération des types

**Files:**
- Create: `supabase/seed.sql`
- Create: `src/types/database.types.ts` (généré)
- Modify: `package.json` (script `db:types`)

**Interfaces:**
- Produces:
  - comptes : `client@vito.test`, `agence@vito.test`, `admin@vito.test` (mot de passe `password123`), avec rôles corrects.
  - `Database` type exporté depuis `src/types/database.types.ts`. Consommé par tous les clients Supabase typés (Task 11).

- [ ] **Step 1: Seed SQL**

`supabase/seed.sql` :

```sql
-- Comptes de dev. Le trigger handle_new_user crée le profil avec le rôle issu de raw_user_meta_data.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Victor (client)","role":"client"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'agence@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Agence Démo","role":"agence"}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@vito.test',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Admin","role":"admin"}', now(), now());

-- Identities (requis pour le login email/password)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"client@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"agence@vito.test"}', 'email', now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"admin@vito.test"}', 'email', now(), now());

-- Tags système d'ambiance
insert into public.tags (slug, label, categorie) values
  ('en_amoureux', 'En amoureux', 'ambiance'),
  ('entre_amis', 'Entre amis', 'ambiance'),
  ('terrasse', 'Terrasse', 'ambiance'),
  ('avec_vue', 'Avec vue', 'ambiance'),
  ('en_famille', 'En famille', 'ambiance'),
  ('business', 'Business', 'ambiance');

-- Établissement démo (référentiel)
insert into public.etablissements (id, place_id, categorie, type, nom, adresse, ville, code_postal, arrondissement, source)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo_place_1', 'resto', 'bistrot',
  'Le Bistrot Démo', '10 rue de Démo', 'Paris', '75017', '17e', 'seed');

-- Le client a déjà un resto dans sa liste
insert into public.liste_items (user_id, etablissement_id, statut, is_favorite)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a_faire', true);
```

- [ ] **Step 2: Reset avec seed**

```bash
supabase db reset
```

Expected: migrations + seed appliqués sans erreur ; 3 users créés.

- [ ] **Step 3: Script de génération des types**

Ajouter à `package.json` :

```json
{ "db:types": "supabase gen types typescript --local > src/types/database.types.ts" }
```

- [ ] **Step 4: Générer les types**

```bash
npm run db:types
```

Expected: `src/types/database.types.ts` contient le type `Database` avec les tables `profiles`, `etablissements`, `tags`, `liste_items`, `liste_item_tags`, `avis`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(db): seed (3 comptes + tags + resto démo) + génération des types"
```

---

### Task 11: Clients Supabase typés + validation d'environnement

**Files:**
- Create: `src/lib/env.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`
- Create: `.env.local`, `.env.example`

**Interfaces:**
- Consumes: `Database` depuis `src/types/database.types.ts`.
- Produces:
  - `createClient()` (browser) → `SupabaseClient<Database>`
  - `createServerSupabase()` (server, cookies) → `SupabaseClient<Database>`
  - `createAdminClient()` (service role, server-only) → `SupabaseClient<Database>`
  - `env` objet typé. Consommés par data layer, guards, services.

- [ ] **Step 1: `.env.local` et `.env.example`**

Reporter les clés imprimées par `supabase start`. `.env.example` (commité) :

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=__from_supabase_start__
SUPABASE_SERVICE_ROLE_KEY=__from_supabase_start__
# Optionnels — en leur absence, adapters mock/fallback utilisés
GOOGLE_PLACES_API_KEY=
ANTHROPIC_API_KEY=
```

`.env.local` (NON commité, déjà ignoré par Next.js) : mêmes clés avec les vraies valeurs locales. Vérifier que `.gitignore` contient `.env*.local`.

- [ ] **Step 2: Validation env (Zod)**

`src/lib/env.ts` :

```ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});
```

- [ ] **Step 3: Installer le SDK**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

- [ ] **Step 4: Client browser**

`src/lib/supabase/client.ts` :

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

- [ ] **Step 5: Client server (cookies)**

`src/lib/supabase/server.ts` :

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // appelé depuis un Server Component : ignoré (le middleware rafraîchit)
          }
        },
      },
    }
  );
}
```

- [ ] **Step 6: Client admin (service role, server-only)**

`src/lib/supabase/admin.ts` :

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

```bash
npm install -D server-only
```

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck`
Expected: aucune erreur (types `Database` résolus).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: clients Supabase typés (browser/server/admin) + validation env"
```

---

# PHASE C — Auth + RBAC

### Task 12: Middleware avec refresh de session Supabase

**Files:**
- Modify: `src/middleware.ts`
- Create: `src/lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `env`, `Database`.
- Produces: session Supabase rafraîchie sur chaque requête + locale next-intl. Cookies à jour pour les Server Components.

- [ ] **Step 1: Helper de session middleware**

`src/lib/supabase/middleware.ts` :

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}
```

- [ ] **Step 2: Composer i18n + session**

`src/middleware.ts` :

```ts
import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 3: Vérifier**

Run: `npm run dev` puis charger `/fr`
Expected: pas d'erreur middleware ; cookies Supabase posés.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: middleware refresh session Supabase + locale"
```

---

### Task 13: Server Actions auth + pages login/signup

**Files:**
- Create: `src/features/auth/data/actions.ts`, `src/features/auth/domain/schemas.ts`
- Create: `src/app/[locale]/(auth)/login/page.tsx`, `src/app/[locale]/(auth)/signup/page.tsx`
- Create: `src/features/auth/ui/AuthForm.tsx`

**Interfaces:**
- Consumes: `createServerSupabase`, `redirect` localisé.
- Produces: `signIn(formData)`, `signUp(formData)`, `signOut()`. Le signup public force `role='client'` (jamais transmis par l'UI).

- [ ] **Step 1: Schémas Zod (test d'abord)**

`src/features/auth/domain/schemas.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { credentialsSchema } from "./schemas";

describe("credentialsSchema", () => {
  it("rejette un email invalide", () => {
    expect(credentialsSchema.safeParse({ email: "x", password: "password123" }).success).toBe(false);
  });
  it("rejette un mot de passe trop court", () => {
    expect(credentialsSchema.safeParse({ email: "a@b.fr", password: "123" }).success).toBe(false);
  });
  it("accepte des identifiants valides", () => {
    expect(credentialsSchema.safeParse({ email: "a@b.fr", password: "password123" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `npm run test -- schemas`
Expected: FAIL (`./schemas` introuvable).

- [ ] **Step 3: Implémenter les schémas**

`src/features/auth/domain/schemas.ts` :

```ts
import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type Credentials = z.infer<typeof credentialsSchema>;
```

- [ ] **Step 4: Lancer (succès attendu)**

Run: `npm run test -- schemas`
Expected: PASS (3 tests).

- [ ] **Step 5: Server Actions**

`src/features/auth/data/actions.ts` :

```ts
"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import { credentialsSchema } from "../domain/schemas";

export async function signIn(_prev: unknown, formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Identifiants invalides" };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Connexion échouée" };
  redirect({ href: "/restos", locale: "fr" });
}

export async function signUp(_prev: unknown, formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Identifiants invalides" };

  const supabase = await createServerSupabase();
  // Signup public : rôle 'client' forcé (jamais depuis l'UI)
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { data: { role: "client" } },
  });
  if (error) return { error: "Inscription échouée" };
  redirect({ href: "/restos", locale: "fr" });
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale: "fr" });
}
```

- [ ] **Step 6: Formulaire partagé**

`src/features/auth/ui/AuthForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthForm({ action, submitLabelKey }: { action: Action; submitLabelKey: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <label>{t("email")}<input name="email" type="email" required className="border p-2 w-full" /></label>
      <label>{t("password")}<input name="password" type="password" required className="border p-2 w-full" /></label>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t(submitLabelKey)}</button>
    </form>
  );
}
```

- [ ] **Step 7: Pages login/signup**

`src/app/[locale]/(auth)/login/page.tsx` :

```tsx
import { AuthForm } from "@/features/auth/ui/AuthForm";
import { signIn } from "@/features/auth/data/actions";

export default function LoginPage() {
  return <main className="p-6"><AuthForm action={signIn} submitLabelKey="login" /></main>;
}
```

`src/app/[locale]/(auth)/signup/page.tsx` :

```tsx
import { AuthForm } from "@/features/auth/ui/AuthForm";
import { signUp } from "@/features/auth/data/actions";

export default function SignupPage() {
  return <main className="p-6"><AuthForm action={signUp} submitLabelKey="signup" /></main>;
}
```

- [ ] **Step 8: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: succès.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(auth): server actions signIn/signUp/signOut + pages (role client forcé au signup)"
```

---

### Task 14: RBAC — guards serveur, gating UI, protection de routes + e2e

**Files:**
- Create: `src/lib/rbac/roles.ts`, `src/lib/rbac/guards.ts`
- Create: `src/app/[locale]/(app)/layout.tsx`
- Create: `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, claim JWT `user_role`.
- Produces:
  - `type AppRole = "client" | "agence" | "admin"`
  - `getSessionRole(): Promise<AppRole | null>` (server)
  - `requireRole(roles: AppRole[]): Promise<AppRole>` (redirige si non autorisé)
  - `can(role, permission)` helper UI. Consommés par les layouts protégés et le back-office (chantiers ultérieurs).

- [ ] **Step 1: Test du helper de permissions (pur)**

`src/lib/rbac/roles.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { can } from "./roles";

describe("can", () => {
  it("admin accède au back-office", () => {
    expect(can("admin", "access:admin")).toBe(true);
  });
  it("client n'accède pas au back-office", () => {
    expect(can("client", "access:admin")).toBe(false);
  });
  it("agence peut créer un voyage pour un client", () => {
    expect(can("agence", "create:voyage_pour_client")).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `npm run test -- roles`
Expected: FAIL (`./roles` introuvable).

- [ ] **Step 3: Implémenter roles.ts**

`src/lib/rbac/roles.ts` :

```ts
export type AppRole = "client" | "agence" | "admin";

export type Permission =
  | "access:admin"
  | "access:app"
  | "create:voyage_pour_client";

const MATRIX: Record<AppRole, Permission[]> = {
  client: ["access:app"],
  agence: ["access:app", "create:voyage_pour_client"],
  admin: ["access:app", "access:admin", "create:voyage_pour_client"],
};

export function can(role: AppRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}
```

- [ ] **Step 4: Lancer (succès attendu)**

Run: `npm run test -- roles`
Expected: PASS (3 tests).

- [ ] **Step 5: Guards serveur**

`src/lib/rbac/guards.ts` :

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "@/lib/i18n/routing";
import type { AppRole } from "./roles";

export async function getSessionRole(): Promise<AppRole | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const role = data?.claims?.user_role;
  if (role === "client" || role === "agence" || role === "admin") return role;
  return null;
}

export async function requireRole(roles: AppRole[]): Promise<AppRole> {
  const role = await getSessionRole();
  if (!role) redirect({ href: "/login", locale: "fr" });
  if (!roles.includes(role!)) redirect({ href: "/login", locale: "fr" });
  return role!;
}
```

- [ ] **Step 6: Layout protégé `(app)`**

`src/app/[locale]/(app)/layout.tsx` :

```tsx
import { requireRole } from "@/lib/rbac/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  return <div className="min-h-dvh">{children}</div>;
}
```

- [ ] **Step 7: e2e auth (rôle dans le JWT + protection)**

`e2e/auth.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

test("redirige les non-authentifiés hors de /restos", async ({ page }) => {
  await page.goto("/fr/restos");
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("le client se connecte et atteint /restos", async ({ page }) => {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
});
```

- [ ] **Step 8: Lancer e2e (Supabase doit tourner)**

```bash
supabase start
npm run test:e2e -- auth
```

Expected: les 2 tests passent.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(rbac): guards serveur + matrice de permissions + protection de routes + e2e auth"
```

---

# PHASE D — Slice vertical Restos

### Task 15: Service `PlacesProvider` (interface + mock + adapter Google)

**Files:**
- Create: `src/lib/services/places/types.ts`, `src/lib/services/places/mock.ts`, `src/lib/services/places/google.ts`, `src/lib/services/places/index.ts`

**Interfaces:**
- Produces:
  - `type PlaceResult` (forme normalisée)
  - `interface PlacesProvider { search(query: string): Promise<PlaceSummary[]>; details(placeId: string): Promise<PlaceResult | null>; }`
  - `getPlacesProvider(): PlacesProvider` (Google si `GOOGLE_PLACES_API_KEY`, sinon Mock). Consommé par `actions.ts` (Task 17) et le proxy photo (Task 18).

- [ ] **Step 1: Types + interface**

`src/lib/services/places/types.ts` :

```ts
export type PlaceSummary = {
  placeId: string;
  nom: string;
  adresse: string | null;
};

export type PlaceResult = {
  placeId: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
  lat: number | null;
  lng: number | null;
  telephone: string | null;
  website: string | null;
  priceLevel: number | null;
  types: string[];
  photoRefs: string[];
};

export interface PlacesProvider {
  search(query: string): Promise<PlaceSummary[]>;
  details(placeId: string): Promise<PlaceResult | null>;
  photoUrl(photoRef: string, maxWidth: number): string | null;
}
```

- [ ] **Step 2: Mock provider (test d'abord)**

`src/lib/services/places/mock.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { MockPlacesProvider } from "./mock";

describe("MockPlacesProvider", () => {
  it("recherche renvoie des résultats filtrés", async () => {
    const p = new MockPlacesProvider();
    const res = await p.search("bistrot");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]!.placeId).toBeTruthy();
  });
  it("details renvoie une fiche complète pour un placeId connu", async () => {
    const p = new MockPlacesProvider();
    const list = await p.search("bistrot");
    const d = await p.details(list[0]!.placeId);
    expect(d?.nom).toBeTruthy();
  });
});
```

- [ ] **Step 3: Lancer (échec attendu)**

Run: `npm run test -- mock`
Expected: FAIL (`./mock` introuvable).

- [ ] **Step 4: Implémenter le mock**

`src/lib/services/places/mock.ts` :

```ts
import type { PlacesProvider, PlaceResult, PlaceSummary } from "./types";

const FIXTURES: PlaceResult[] = [
  {
    placeId: "mock_bistrot_1",
    nom: "Le Bistrot du Coin",
    adresse: "12 rue des Acacias",
    ville: "Paris",
    codePostal: "75017",
    lat: 48.878,
    lng: 2.295,
    telephone: "+33 1 42 00 00 00",
    website: "https://exemple.fr",
    priceLevel: 2,
    types: ["restaurant", "bistro"],
    photoRefs: ["mock_photo_1"],
  },
  {
    placeId: "mock_etoile_1",
    nom: "La Table Étoilée",
    adresse: "1 avenue Gourmet",
    ville: "Paris",
    codePostal: "75008",
    lat: 48.87,
    lng: 2.31,
    telephone: "+33 1 43 00 00 00",
    website: "https://exemple-etoile.fr",
    priceLevel: 4,
    types: ["restaurant", "fine_dining"],
    photoRefs: ["mock_photo_2"],
  },
];

export class MockPlacesProvider implements PlacesProvider {
  async search(query: string): Promise<PlaceSummary[]> {
    const q = query.toLowerCase();
    return FIXTURES.filter(
      (f) => f.nom.toLowerCase().includes(q) || f.types.some((t) => t.includes(q))
    ).map((f) => ({ placeId: f.placeId, nom: f.nom, adresse: f.adresse }));
  }
  async details(placeId: string): Promise<PlaceResult | null> {
    return FIXTURES.find((f) => f.placeId === placeId) ?? null;
  }
  photoUrl(photoRef: string): string | null {
    // En mock, une image placeholder data-URI déterministe
    return photoRef ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" : null;
  }
}
```

- [ ] **Step 5: Lancer (succès attendu)**

Run: `npm run test -- mock`
Expected: PASS.

- [ ] **Step 6: Adapter Google (encapsulé, gestion d'erreurs)**

`src/lib/services/places/google.ts` :

```ts
import type { PlacesProvider, PlaceResult, PlaceSummary } from "./types";

// Places API (New). Conforme ToS : on ne stocke jamais les bytes des photos.
export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<PlaceSummary[]> {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "fr" }),
    });
    if (!res.ok) throw new Error(`Places search ${res.status}`);
    const json = (await res.json()) as {
      places?: { id: string; displayName?: { text: string }; formattedAddress?: string }[];
    };
    return (json.places ?? []).map((p) => ({
      placeId: p.id,
      nom: p.displayName?.text ?? "",
      adresse: p.formattedAddress ?? null,
    }));
  }

  async details(placeId: string): Promise<PlaceResult | null> {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,internationalPhoneNumber,websiteUri,priceLevel,types,photos,addressComponents",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Places details ${res.status}`);
    const p = (await res.json()) as Record<string, unknown>;
    const loc = p.location as { latitude?: number; longitude?: number } | undefined;
    const comps = (p.addressComponents as { types: string[]; longText: string }[] | undefined) ?? [];
    const cp = comps.find((c) => c.types.includes("postal_code"))?.longText ?? null;
    const ville = comps.find((c) => c.types.includes("locality"))?.longText ?? null;
    const photos = (p.photos as { name: string }[] | undefined) ?? [];
    return {
      placeId: p.id as string,
      nom: (p.displayName as { text: string } | undefined)?.text ?? "",
      adresse: (p.formattedAddress as string) ?? null,
      ville,
      codePostal: cp,
      lat: loc?.latitude ?? null,
      lng: loc?.longitude ?? null,
      telephone: (p.internationalPhoneNumber as string) ?? null,
      website: (p.websiteUri as string) ?? null,
      priceLevel: priceLevelToInt(p.priceLevel as string | undefined),
      types: (p.types as string[]) ?? [],
      photoRefs: photos.map((ph) => ph.name),
    };
  }

  photoUrl(photoRef: string, maxWidth: number): string | null {
    if (!photoRef) return null;
    return `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=${maxWidth}&key=${this.apiKey}`;
  }
}

function priceLevelToInt(level: string | undefined): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return level && level in map ? map[level]! : null;
}
```

- [ ] **Step 7: Sélecteur**

`src/lib/services/places/index.ts` :

```ts
import { env } from "@/lib/env";
import { MockPlacesProvider } from "./mock";
import { GooglePlacesProvider } from "./google";
import type { PlacesProvider } from "./types";

export function getPlacesProvider(): PlacesProvider {
  if (env.GOOGLE_PLACES_API_KEY) {
    return new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY);
  }
  return new MockPlacesProvider();
}

export type { PlacesProvider, PlaceResult, PlaceSummary } from "./types";
```

- [ ] **Step 8: Vérifier**

Run: `npm run test && npm run typecheck`
Expected: succès.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(places): abstraction PlacesProvider + adapter mock + adapter Google (place_id, pas de stockage photo)"
```

---

### Task 16: Domaine Restos — mapping + classification fallback (pur, testé)

**Files:**
- Create: `src/features/restos/domain/classifyFallback.ts`, `src/features/restos/domain/mapPlaceToEtablissement.ts`, `src/features/restos/domain/schemas.ts`

**Interfaces:**
- Consumes: `PlaceResult` (Task 15).
- Produces:
  - `classifyFallback(types: string[], priceLevel: number | null): string` → ex. `"étoilé" | "bistrot" | "brasserie" | "restaurant"`
  - `mapPlaceToEtablissement(p: PlaceResult): EtablissementInput` (forme acceptée par la RPC `upsert_etablissement`)
  - `addRestoSchema`, `addAvisSchema`, `setTagsSchema` (Zod). Consommés par `actions.ts` (Task 17).

- [ ] **Step 1: Test classification fallback**

`src/features/restos/domain/classifyFallback.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { classifyFallback } from "./classifyFallback";

describe("classifyFallback", () => {
  it("priceLevel 4 + fine_dining => étoilé", () => {
    expect(classifyFallback(["restaurant", "fine_dining"], 4)).toBe("étoilé");
  });
  it("type bistro => bistrot", () => {
    expect(classifyFallback(["restaurant", "bistro"], 2)).toBe("bistrot");
  });
  it("type brasserie => brasserie", () => {
    expect(classifyFallback(["brasserie"], 2)).toBe("brasserie");
  });
  it("défaut => restaurant", () => {
    expect(classifyFallback(["restaurant"], 1)).toBe("restaurant");
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `npm run test -- classifyFallback`
Expected: FAIL.

- [ ] **Step 3: Implémenter classifyFallback**

`src/features/restos/domain/classifyFallback.ts` :

```ts
// Classification sans coût LLM (fallback). Le LLM affinera plus tard (services/llm).
export function classifyFallback(types: string[], priceLevel: number | null): string {
  const t = types.map((x) => x.toLowerCase());
  if ((priceLevel ?? 0) >= 4 || t.some((x) => x.includes("fine_dining"))) return "étoilé";
  if (t.some((x) => x.includes("bistro"))) return "bistrot";
  if (t.some((x) => x.includes("brasserie"))) return "brasserie";
  if (t.some((x) => x.includes("cafe"))) return "café";
  return "restaurant";
}
```

- [ ] **Step 4: Lancer (succès attendu)**

Run: `npm run test -- classifyFallback`
Expected: PASS.

- [ ] **Step 5: Test mapping**

`src/features/restos/domain/mapPlaceToEtablissement.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mapPlaceToEtablissement } from "./mapPlaceToEtablissement";
import type { PlaceResult } from "@/lib/services/places/types";

const place: PlaceResult = {
  placeId: "mock_etoile_1", nom: "La Table Étoilée", adresse: "1 av Gourmet",
  ville: "Paris", codePostal: "75008", lat: 48.87, lng: 2.31,
  telephone: "+33 1 43 00 00 00", website: "https://x.fr", priceLevel: 4,
  types: ["restaurant", "fine_dining"], photoRefs: ["p"],
};

describe("mapPlaceToEtablissement", () => {
  it("mappe les champs et déduit l'arrondissement parisien", () => {
    const e = mapPlaceToEtablissement(place);
    expect(e.place_id).toBe("mock_etoile_1");
    expect(e.type).toBe("étoilé");
    expect(e.arrondissement).toBe("8e");
    expect(e.categorie).toBe("resto");
    expect(e.source).toBe("places");
  });
});
```

- [ ] **Step 6: Lancer (échec attendu)**

Run: `npm run test -- mapPlaceToEtablissement`
Expected: FAIL.

- [ ] **Step 7: Implémenter le mapping**

`src/features/restos/domain/mapPlaceToEtablissement.ts` :

```ts
import type { PlaceResult } from "@/lib/services/places/types";
import { classifyFallback } from "./classifyFallback";

export type EtablissementInput = {
  place_id: string;
  categorie: "resto" | "hotel";
  type: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  arrondissement: string | null;
  lat: number | null;
  lng: number | null;
  telephone: string | null;
  website: string | null;
  price_level: number | null;
  source: string;
};

function arrondissementParisien(codePostal: string | null, ville: string | null): string | null {
  if (!codePostal || !ville || !ville.toLowerCase().includes("paris")) return null;
  if (!/^75\d{3}$/.test(codePostal)) return null;
  const n = Number(codePostal.slice(3));
  return n >= 1 && n <= 20 ? `${n}e` : null;
}

export function mapPlaceToEtablissement(p: PlaceResult): EtablissementInput {
  return {
    place_id: p.placeId,
    categorie: "resto",
    type: classifyFallback(p.types, p.priceLevel),
    nom: p.nom,
    adresse: p.adresse,
    ville: p.ville,
    code_postal: p.codePostal,
    arrondissement: arrondissementParisien(p.codePostal, p.ville),
    lat: p.lat,
    lng: p.lng,
    telephone: p.telephone,
    website: p.website,
    price_level: p.priceLevel,
    source: "places",
  };
}
```

- [ ] **Step 8: Lancer (succès attendu)**

Run: `npm run test -- mapPlaceToEtablissement`
Expected: PASS.

- [ ] **Step 9: Schémas d'entrée**

`src/features/restos/domain/schemas.ts` :

```ts
import { z } from "zod";

export const addRestoSchema = z.object({
  placeId: z.string().min(1),
});

export const addAvisSchema = z.object({
  etablissementId: z.string().uuid(),
  note: z.coerce.number().int().min(1).max(5).optional(),
  commentaire: z.string().max(2000).optional(),
  visiteLe: z.string().date().optional(),
});

export const setTagsSchema = z.object({
  listeItemId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()),
});

export const toggleFavoriteSchema = z.object({
  listeItemId: z.string().uuid(),
  isFavorite: z.coerce.boolean(),
});
```

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(restos): domaine pur — classification fallback + mapping place + schémas Zod (testés)"
```

---

### Task 17: Data layer Restos (Server Actions via RPC + lectures)

**Files:**
- Create: `src/features/restos/data/actions.ts`, `src/features/restos/data/queries.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `getPlacesProvider`, `mapPlaceToEtablissement`, schémas Zod, RPC `upsert_etablissement`.
- Produces:
  - `searchPlaces(query): Promise<PlaceSummary[]>`
  - `addResto(formData): Promise<{ error?: string }>` (upsert établissement via RPC + crée le `liste_item`)
  - `toggleFavorite(formData)`, `addAvis(formData)`, `setTags(formData)`
  - `getMaListe()`, `getFiche(etablissementId)`. Consommés par les pages/UI (Task 19).

- [ ] **Step 1: Lectures**

`src/features/restos/data/queries.ts` :

```ts
import { createServerSupabase } from "@/lib/supabase/server";

export async function getMaListe() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("liste_items")
    .select("id, statut, is_favorite, etablissement:etablissements(id, nom, type, ville, arrondissement)")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getFiche(etablissementId: string) {
  const supabase = await createServerSupabase();
  const [{ data: etab }, { data: item }, { data: avis }] = await Promise.all([
    supabase.from("etablissements").select("*").eq("id", etablissementId).single(),
    supabase.from("liste_items").select("id, statut, is_favorite").eq("etablissement_id", etablissementId).maybeSingle(),
    supabase.from("avis").select("*").eq("etablissement_id", etablissementId).order("created_at", { ascending: false }),
  ]);
  return { etab, item, avis: avis ?? [] };
}

export async function getTags() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tags").select("id, slug, label").order("label");
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Server Actions**

`src/features/restos/data/actions.ts` :

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacesProvider } from "@/lib/services/places";
import { mapPlaceToEtablissement } from "../domain/mapPlaceToEtablissement";
import {
  addRestoSchema, addAvisSchema, setTagsSchema, toggleFavoriteSchema,
} from "../domain/schemas";

export async function searchPlaces(query: string) {
  if (!query.trim()) return [];
  return getPlacesProvider().search(query);
}

export async function addResto(_prev: unknown, formData: FormData) {
  const parsed = addRestoSchema.safeParse({ placeId: formData.get("placeId") });
  if (!parsed.success) return { error: "Place invalide" };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };

  const place = await getPlacesProvider().details(parsed.data.placeId);
  if (!place) return { error: "Établissement introuvable" };

  const input = mapPlaceToEtablissement(place);
  const { data: etabId, error: rpcErr } = await supabase.rpc("upsert_etablissement", {
    p: { ...input, enriched_at: new Date().toISOString() },
  });
  if (rpcErr || !etabId) return { error: "Enregistrement échoué" };

  const { error: itemErr } = await supabase
    .from("liste_items")
    .upsert({ user_id: auth.user.id, etablissement_id: etabId }, { onConflict: "user_id,etablissement_id" });
  if (itemErr) return { error: "Ajout à la liste échoué" };

  revalidatePath("/restos");
  return {};
}

export async function toggleFavorite(_prev: unknown, formData: FormData) {
  const parsed = toggleFavoriteSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    isFavorite: formData.get("isFavorite"),
  });
  if (!parsed.success) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("liste_items")
    .update({ is_favorite: parsed.data.isFavorite })
    .eq("id", parsed.data.listeItemId);
  if (error) return { error: "Mise à jour échouée" };
  revalidatePath("/restos");
  return {};
}

export async function addAvis(_prev: unknown, formData: FormData) {
  const parsed = addAvisSchema.safeParse({
    etablissementId: formData.get("etablissementId"),
    note: formData.get("note") || undefined,
    commentaire: formData.get("commentaire") || undefined,
    visiteLe: formData.get("visiteLe") || undefined,
  });
  if (!parsed.success) return { error: "Avis invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { error } = await supabase.from("avis").insert({
    user_id: auth.user.id,
    etablissement_id: parsed.data.etablissementId,
    note: parsed.data.note ?? null,
    commentaire: parsed.data.commentaire ?? null,
    visite_le: parsed.data.visiteLe ?? null,
  });
  if (error) return { error: "Avis non enregistré" };
  revalidatePath(`/restos/${parsed.data.etablissementId}`);
  return {};
}

export async function setTags(_prev: unknown, formData: FormData) {
  const parsed = setTagsSchema.safeParse({
    listeItemId: formData.get("listeItemId"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) return { error: "Tags invalides" };
  const supabase = await createServerSupabase();
  await supabase.from("liste_item_tags").delete().eq("liste_item_id", parsed.data.listeItemId);
  if (parsed.data.tagIds.length > 0) {
    const rows = parsed.data.tagIds.map((tag_id) => ({ liste_item_id: parsed.data.listeItemId, tag_id }));
    const { error } = await supabase.from("liste_item_tags").insert(rows);
    if (error) return { error: "Tags non enregistrés" };
  }
  revalidatePath("/restos");
  return {};
}
```

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck`
Expected: aucune erreur (signatures RPC et tables résolues depuis `Database`).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(restos): data layer — addResto via RPC, favori, avis, tags, lectures"
```

---

### Task 18: Proxy photo conforme (à la volée, jamais stockée)

**Files:**
- Create: `src/app/api/places/photo/route.ts`

**Interfaces:**
- Consumes: `getPlacesProvider().photoUrl`.
- Produces: `GET /api/places/photo?ref=<photoRef>&w=<width>` → renvoie les bytes de l'image en streaming (aucune persistance).

- [ ] **Step 1: Route handler**

`src/app/api/places/photo/route.ts` :

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getPlacesProvider } from "@/lib/services/places";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  const width = Number(request.nextUrl.searchParams.get("w") ?? "800");
  if (!ref) return NextResponse.json({ error: "ref manquant" }, { status: 400 });

  const url = getPlacesProvider().photoUrl(ref, Number.isFinite(width) ? width : 800);
  if (!url) return NextResponse.json({ error: "indisponible" }, { status: 404 });

  if (url.startsWith("data:")) return NextResponse.redirect(url);

  const upstream = await fetch(url);
  if (!upstream.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

  // Streaming direct : les bytes ne sont jamais persistés (conformité ToS)
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run build`
Expected: build OK, route `/api/places/photo` listée.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(places): proxy photo à la volée (conforme ToS, aucune persistance)"
```

---

### Task 19: UI Restos (recherche, ajout, liste, fiche, tags, favori, avis)

**Files:**
- Create: `src/features/restos/ui/RestoSearch.tsx`, `RestoList.tsx`, `FicheResto.tsx`, `AvisForm.tsx`, `FavoriteToggle.tsx`
- Create: `src/app/[locale]/(app)/restos/page.tsx`, `src/app/[locale]/(app)/restos/[id]/page.tsx`

**Interfaces:**
- Consumes: actions et queries de la Task 17, traductions `restos.*`.
- Produces: parcours UI complet. Sélecteurs e2e : `add-resto-search`, `search-result`, `resto-card`, `favorite-toggle`, `avis-form`.

- [ ] **Step 1: Recherche + ajout (client component)**

`src/features/restos/ui/RestoSearch.tsx` :

```tsx
"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchPlaces, addResto } from "../data/actions";
import type { PlaceSummary } from "@/lib/services/places/types";

export function RestoSearch() {
  const t = useTranslations("restos");
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <input
        data-testid="add-resto-search"
        placeholder={t("search")}
        className="border p-2"
        onChange={(e) => {
          const q = e.target.value;
          start(async () => setResults(await searchPlaces(q)));
        }}
      />
      <ul>
        {results.map((r) => (
          <li key={r.placeId} data-testid="search-result" className="flex justify-between border-b py-2">
            <span>{r.nom} — {r.adresse}</span>
            <form action={(fd) => start(async () => { await addResto(undefined, fd); setResults([]); })}>
              <input type="hidden" name="placeId" value={r.placeId} />
              <button type="submit" disabled={pending} className="underline">{t("add")}</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Liste perso**

`src/features/restos/ui/RestoList.tsx` :

```tsx
import { getMaListe } from "../data/queries";
import { Link } from "@/lib/i18n/routing";

export async function RestoList() {
  const items = await getMaListe();
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => {
        const etab = Array.isArray(it.etablissement) ? it.etablissement[0] : it.etablissement;
        if (!etab) return null;
        return (
          <li key={it.id} data-testid="resto-card" className="border p-3 flex justify-between">
            <Link href={`/restos/${etab.id}`}>
              {etab.nom} {it.is_favorite ? "★" : ""} <span className="text-gray-500">({etab.type ?? "—"})</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: Toggle favori**

`src/features/restos/ui/FavoriteToggle.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { toggleFavorite } from "../data/actions";

export function FavoriteToggle({ listeItemId, isFavorite }: { listeItemId: string; isFavorite: boolean }) {
  const [, action] = useActionState(toggleFavorite, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <input type="hidden" name="isFavorite" value={String(!isFavorite)} />
      <button type="submit" data-testid="favorite-toggle">{isFavorite ? "★ Favori" : "☆ Favori"}</button>
    </form>
  );
}
```

- [ ] **Step 4: Formulaire avis**

`src/features/restos/ui/AvisForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addAvis } from "../data/actions";

export function AvisForm({ etablissementId }: { etablissementId: string }) {
  const t = useTranslations("restos");
  const [state, action, pending] = useActionState(addAvis, undefined);
  return (
    <form action={action} data-testid="avis-form" className="flex flex-col gap-2">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input name="note" type="number" min={1} max={5} placeholder="Note (1-5)" className="border p-2" />
      <textarea name="commentaire" placeholder="Mon avis…" className="border p-2" />
      <input name="visiteLe" type="date" className="border p-2" />
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("addAvis")}</button>
    </form>
  );
}
```

- [ ] **Step 5: Fiche**

`src/features/restos/ui/FicheResto.tsx` :

```tsx
import { getFiche } from "../data/queries";
import { FavoriteToggle } from "./FavoriteToggle";
import { AvisForm } from "./AvisForm";

export async function FicheResto({ etablissementId }: { etablissementId: string }) {
  const { etab, item, avis } = await getFiche(etablissementId);
  if (!etab) return <p>Introuvable</p>;
  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">{etab.nom}</h1>
        <p className="text-gray-600">{etab.type} — {etab.adresse} {etab.arrondissement ?? ""}</p>
        {etab.telephone && <p>{etab.telephone}</p>}
      </header>
      {item && <FavoriteToggle listeItemId={item.id} isFavorite={item.is_favorite} />}
      <section>
        <h2 className="font-semibold">Avis</h2>
        <ul>{avis.map((a) => <li key={a.id} className="border-b py-1">{a.note ? `${a.note}/5 — ` : ""}{a.commentaire}</li>)}</ul>
        <AvisForm etablissementId={etab.id} />
      </section>
    </article>
  );
}
```

- [ ] **Step 6: Pages**

`src/app/[locale]/(app)/restos/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { RestoSearch } from "@/features/restos/ui/RestoSearch";
import { RestoList } from "@/features/restos/ui/RestoList";

export default async function RestosPage() {
  const t = await getTranslations("restos");
  return (
    <main className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <RestoSearch />
      <RestoList />
    </main>
  );
}
```

`src/app/[locale]/(app)/restos/[id]/page.tsx` :

```tsx
import { FicheResto } from "@/features/restos/ui/FicheResto";

export default async function FicheRestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-6"><FicheResto etablissementId={id} /></main>;
}
```

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck && npm run build`
Expected: build OK.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(restos): UI complète (recherche, ajout, liste, fiche, favori, avis)"
```

---

### Task 20: e2e du parcours Restos complet

**Files:**
- Create: `e2e/restos.spec.ts`

**Interfaces:**
- Consumes: comptes seed, sélecteurs `data-testid` de la Task 19, provider mock (pas de clé Google requise).

- [ ] **Step 1: Test e2e du parcours**

`e2e/restos.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill("client@vito.test");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("ajouter un resto via recherche, puis consulter sa fiche et ajouter un avis", async ({ page }) => {
  await login(page);

  // Recherche (provider mock) + ajout
  await page.getByTestId("add-resto-search").fill("bistrot");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.getByTestId("search-result").first().getByRole("button").click();

  // Le resto apparaît dans la liste
  await expect(page.getByTestId("resto-card").filter({ hasText: "Bistrot" }).first()).toBeVisible();

  // Ouvrir la fiche et ajouter un avis
  await page.getByTestId("resto-card").first().getByRole("link").click();
  await page.getByTestId("avis-form").locator("textarea").fill("Très bonne adresse, revenir le samedi");
  await page.getByTestId("avis-form").getByRole("button").click();
  await expect(page.getByText("Très bonne adresse")).toBeVisible();
});

test("basculer un favori", async ({ page }) => {
  await login(page);
  await page.getByTestId("resto-card").first().getByRole("link").click();
  await page.getByTestId("favorite-toggle").click();
  await expect(page.getByTestId("favorite-toggle")).toContainText("Favori");
});
```

- [ ] **Step 2: Lancer (Supabase + mock provider)**

```bash
supabase start
npm run test:e2e -- restos
```

Expected: les tests passent (provider mock, aucune clé Google requise).

- [ ] **Step 3: Suite complète + qualité**

Run: `npm run typecheck && npm run lint && npm run test && npm run test:e2e`
Expected: tout vert.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(restos): e2e parcours complet (ajout via recherche, fiche, avis, favori)"
```

---

## Self-review (auteur)

**Couverture du spec :**
- Scaffold Next.js/TS strict/Tailwind/PWA/CI → Tasks 1–6. ✓
- Supabase local + migrations versionnées → Tasks 7–10. ✓
- RLS sur chaque table → migrations 00001/00003 (chaque `create table` suivi de `enable row level security` + policy). ✓
- RBAC client/agence/admin via claim JWT → Tasks 8, 14. ✓
- RPC `security definer` pour écriture contrôlée du référentiel → Task 9 (`upsert_etablissement`). ✓
- Types source de vérité (générés) → Task 10. ✓
- Abstraction Places mock-first + adapter Google + conformité photos (proxy, place_id) → Tasks 15, 18. ✓
- Classification fallback sans coût LLM → Task 16 (LLM différé, abstraction notée). ✓
- Comptes seed (client/agence/admin) → Task 10. ✓
- Slice Restos bout en bout testé (unit + e2e) → Tasks 15–20. ✓
- i18n architecture dès le départ → Task 2. ✓
- Séparation couches app/features/lib → structure des fichiers respectée. ✓

**Cohérence des types :** signature RPC `upsert_etablissement(p jsonb)` (Task 9) ↔ appel `supabase.rpc("upsert_etablissement", { p })` (Task 17) ; `EtablissementInput` (Task 16) ↔ champs lus par la RPC ; claim `user_role` (Task 8) ↔ `getSessionRole` (Task 14) ↔ policies RLS (Tasks 7, 9). Cohérents.

**Arbitrages signalés (rappel) :** clé Google et clé Anthropic à fournir par l'utilisateur (sinon mock/fallback) ; LLM désactivé par défaut (coût) ; chiffrement `documents_voyage` reporté au Chantier 4 ; PWA icônes placeholder à remplacer par de vrais assets avant prod.

**Note de dette assumée :** les icônes PWA sont des placeholders 1×1 (Task 4) — à remplacer par de vrais assets avant la prod (signalé, pas masqué).
