# Documents chiffrés (voyages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attacher des documents (PDF/images ≤ 5 Mo) à un voyage, chiffrés AES-256-GCM (clé hors DB), accessibles aux membres du voyage.

**Architecture:** Chiffrement pur dans `lib/crypto/documents.ts` (clé en paramètre, testable) + `lib/crypto/documentKey.ts` (lit la clé en env). Ciphertext stocké en **base64/text** dans `voyage_documents` (RLS `can_access_voyage`). Upload = server action (chiffre), download = Route Handler `/api/voyages/documents/[id]` (RLS → 404 non-membre, déchiffre, renvoie les octets). Intégré à la fiche voyage.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Route Handlers), Node `crypto`, TypeScript strict, Supabase (Postgres + RLS), next-intl, Vitest, Playwright.

## Global Constraints

- Next.js 16 non-standard : consulter `node_modules/next/dist/docs/` avant une API Next inconnue.
- TypeScript strict avec `noUncheckedIndexedAccess`.
- **Chiffrement AES-256-GCM applicatif, clé hors DB** : `DOCUMENTS_ENCRYPTION_KEY` (64 hex = 32 octets) en env server-only. Jamais en DB, jamais côté client.
- Ciphertext = base64 d'`iv(12)||authTag(16)||ciphertext` dans une colonne `text`.
- Accès **collaboratif** : membres du voyage via `can_access_voyage` (RLS + route). Un non-membre → **404**.
- Limites : `taille ≤ 5 242 880` (5 Mo) ; `mime_type ∈ {application/pdf, image/jpeg, image/png, image/webp}`.
- RLS + grants sur `voyage_documents`. `uploaded_by`/session, jamais client.
- Migration suivante = `00016_voyage_documents.sql`. Composants sous `features/voyages/ui/`, route `/api/voyages/documents/[id]`.
- Aucune chaîne UI en dur (`voyages.documents.*`). UUID seed = v4 valides.

---

### Task 1: Chiffrement (`lib/crypto`) + env + wiring de la clé

**Files:**
- Create: `src/lib/crypto/documents.ts` + `documents.test.ts`
- Create: `src/lib/crypto/documentKey.ts`
- Modify: `src/lib/env.ts` (ajout `DOCUMENTS_ENCRYPTION_KEY`)
- Modify: `.env.example` (documentation de la variable)
- Modify: `.github/workflows/ci.yml` (clé de test pour la CI)

**Interfaces:**
- Produces:
  - `encryptDocument(plain: Buffer, key: Buffer): Buffer` (`iv||tag||ciphertext`).
  - `decryptDocument(blob: Buffer, key: Buffer): Buffer` (throw si clé invalide / tag altéré / blob trop court).
  - `getDocumentKey(): Buffer` (décode `env.DOCUMENTS_ENCRYPTION_KEY`, throw si absente/longueur ≠ 32).

- [ ] **Step 1: Écrire le test (échec attendu)**

Create `src/lib/crypto/documents.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptDocument, decryptDocument } from "./documents";

const key = randomBytes(32);

describe("documents crypto (AES-256-GCM)", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const plain = Buffer.from("billet de train — réf ABC123 — ☕");
    const blob = encryptDocument(plain, key);
    expect(decryptDocument(blob, key).equals(plain)).toBe(true);
  });
  it("le ciphertext diffère du clair", () => {
    const plain = Buffer.from("secret");
    const blob = encryptDocument(plain, key);
    expect(blob.includes(plain)).toBe(false);
  });
  it("blob altéré -> throw (tag GCM)", () => {
    const blob = encryptDocument(Buffer.from("x".repeat(50)), key);
    blob[blob.length - 1] ^= 0xff; // flip le dernier octet du ciphertext
    expect(() => decryptDocument(blob, key)).toThrow();
  });
  it("clé de mauvaise longueur -> throw", () => {
    expect(() => encryptDocument(Buffer.from("x"), randomBytes(16))).toThrow();
  });
});
```

- [ ] **Step 2: Lancer (échec)**

Run: `npx vitest run src/lib/crypto/documents.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter documents.ts (pur, AUCUN import d'env)**

Create `src/lib/crypto/documents.ts` :
```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptDocument(plain: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error("clé invalide : 32 octets attendus");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptDocument(blob: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error("clé invalide : 32 octets attendus");
  if (blob.length < IV_LEN + TAG_LEN) throw new Error("blob invalide");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]); // throw si tag invalide
}
```
(Important : ce fichier n'importe PAS `@/lib/env` — le test reste indépendant de l'env.)

- [ ] **Step 4: Lancer (succès)**

Run: `npx vitest run src/lib/crypto/documents.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: env + getDocumentKey + wiring**

Modify `src/lib/env.ts` — ajouter dans le `schema` (après `STRIPE_SECRET_KEY`) :
```ts
  DOCUMENTS_ENCRYPTION_KEY: z.string().optional(),
```
et dans l'objet `safeParse` :
```ts
  DOCUMENTS_ENCRYPTION_KEY: process.env.DOCUMENTS_ENCRYPTION_KEY,
```

Create `src/lib/crypto/documentKey.ts` :
```ts
import { env } from "@/lib/env";

export function getDocumentKey(): Buffer {
  const hex = env.DOCUMENTS_ENCRYPTION_KEY;
  if (!hex) throw new Error("DOCUMENTS_ENCRYPTION_KEY manquante");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("DOCUMENTS_ENCRYPTION_KEY doit faire 64 caractères hex (32 octets)");
  return key;
}
```

Modify `.env.example` — ajouter une ligne :
```
# Clé de chiffrement des documents voyages (AES-256-GCM) — 64 caractères hex (32 octets). NE PAS commiter de vraie clé.
DOCUMENTS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Modify `.github/workflows/ci.yml` — dans le step qui pousse les variables vers `$GITHUB_ENV` (celui avec les `echo "...=$(supabase status ...)" >> "$GITHUB_ENV"`), ajouter une ligne (clé de TEST déterministe, non secrète, pour que l'e2e chiffre/déchiffre dans le même run) :
```bash
          echo "DOCUMENTS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" >> "$GITHUB_ENV"
```

- [ ] **Step 6: Régler la clé en local (pour l'e2e/dev) + vérifier**

Run:
```bash
grep -q '^DOCUMENTS_ENCRYPTION_KEY=' .env.local || echo "DOCUMENTS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" >> .env.local
npx vitest run src/lib/crypto/documents.test.ts && npm run typecheck && npm run lint
```
Expected: 4 tests PASS ; typecheck/lint clean. (`.env.local` est gitignored — ce réglage est local, non commité ; la CI a sa propre ligne dans `ci.yml`, et la prod via Vercel à la clôture.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/crypto src/lib/env.ts .env.example .github/workflows/ci.yml
git commit -m "feat(documents): crypto AES-256-GCM (pur, testé) + clé hors DB (env/CI)"
```

---

### Task 2: Migration `00016_voyage_documents.sql`

**Files:**
- Create: `supabase/migrations/00016_voyage_documents.sql`

**Interfaces:**
- Produces : table `voyage_documents` (RLS `can_access_voyage`, collaboratif).

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/00016_voyage_documents.sql` :
```sql
create table public.voyage_documents (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  taille integer not null check (taille > 0 and taille <= 5242880),
  contenu_chiffre text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index voyage_documents_voyage_idx on public.voyage_documents (voyage_id);

alter table public.voyage_documents enable row level security;
create policy "voyage_documents_all" on public.voyage_documents for all
  using (public.can_access_voyage(voyage_id))
  with check (public.can_access_voyage(voyage_id));

grant select, insert, update, delete on public.voyage_documents to authenticated;
```

- [ ] **Step 2: Appliquer**

Run: `supabase db reset`
Expected: applique 00001→00016 + seed sans erreur.

- [ ] **Step 3: Vérifier structure**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select count(*) as t from pg_tables where schemaname='public' and tablename='voyage_documents';
select count(*) as p from pg_policies where tablename='voyage_documents';
"
```
Expected: `t = 1` ; `p = 1`. (Si `psql` absent : `docker exec -i supabase_db_Vito psql -U postgres -d postgres -c "..."`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00016_voyage_documents.sql
git commit -m "feat(documents): migration 00016 (voyage_documents, RLS can_access_voyage)"
```

---

### Task 3: Data (actions + queries) + Route Handler download

**Files:**
- Create: `src/features/voyages/data/documents.ts` (actions documents — `"use server"`)
- Modify: `src/features/voyages/data/queries.ts` (ajout `getVoyageDocuments`)
- Create: `src/app/api/voyages/documents/[id]/route.ts`

**Interfaces:**
- Consumes: `encryptDocument`/`decryptDocument` (`@/lib/crypto/documents`) ; `getDocumentKey` (`@/lib/crypto/documentKey`) ; `createServerSupabase` ; `revalidatePath`.
- Produces:
  - `getVoyageDocuments(voyageId): Promise<{ id; nom; mime_type; taille; created_at }[]>` (dans `queries.ts`, PAS `"use server"`).
  - actions `ajouterDocument(_prev, formData) => { ok } | { error }`, `supprimerDocument(_prev, formData) => { ok } | { error }` (dans `documents.ts`, `"use server"`).
  - `GET /api/voyages/documents/[id]` (octets déchiffrés ou 404/500).

- [ ] **Step 1a: Ajouter `getVoyageDocuments` à `queries.ts`**

Modify `src/features/voyages/data/queries.ts` — ajouter en fin de fichier (ce fichier n'a PAS `"use server"` : c'est une query, pas une action) :
```ts
export async function getVoyageDocuments(voyageId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("voyage_documents")
    .select("id, nom, mime_type, taille, created_at")
    .eq("voyage_id", voyageId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```
(`createServerSupabase` est déjà importé dans `queries.ts`.)

- [ ] **Step 1b: Créer `documents.ts` (actions seulement — `"use server"`)**

Create `src/features/voyages/data/documents.ts` :
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { encryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_TAILLE = 5 * 1024 * 1024;

export async function ajouterDocument(_prev: unknown, formData: FormData) {
  const voyageId = formData.get("voyageId");
  const file = formData.get("file");
  if (typeof voyageId !== "string" || !(file instanceof File)) return { error: "Entrée invalide" };
  if (!ALLOWED.includes(file.type)) return { error: "Type non supporté" };
  if (file.size <= 0 || file.size > MAX_TAILLE) return { error: "Fichier vide ou trop volumineux (max 5 Mo)" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  let chiffre: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    chiffre = encryptDocument(buf, getDocumentKey()).toString("base64");
  } catch {
    return { error: "Chiffrement indisponible" };
  }
  const { error } = await supabase.from("voyage_documents").insert({
    voyage_id: voyageId,
    nom: file.name,
    mime_type: file.type,
    taille: file.size,
    contenu_chiffre: chiffre,
    uploaded_by: auth.user.id,
  });
  if (error) return { error: "Dépôt échoué" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}

export async function supprimerDocument(_prev: unknown, formData: FormData) {
  const id = formData.get("documentId");
  const voyageId = formData.get("voyageId");
  if (typeof id !== "string" || typeof voyageId !== "string") return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { data, error } = await supabase.from("voyage_documents").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Suppression échouée" };
  if (!data) return { error: "Suppression non autorisée" };
  revalidatePath(`/voyages/${voyageId}`);
  return { ok: true as const };
}
```

- [ ] **Step 2: Implémenter le Route Handler**

Create `src/app/api/voyages/documents/[id]/route.ts` :
```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  // RLS can_access_voyage : un non-membre n'obtient aucune ligne -> 404 (aucune fuite).
  const { data, error } = await supabase
    .from("voyage_documents")
    .select("nom, mime_type, contenu_chiffre")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  let bytes: Buffer;
  try {
    bytes = decryptDocument(Buffer.from(data.contenu_chiffre, "base64"), getDocumentKey());
  } catch {
    return NextResponse.json({ error: "déchiffrement" }, { status: 500 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": data.mime_type,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(data.nom)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
```

- [ ] **Step 3: Régénérer `database.types.ts` (nouvelle table) + vérifier**

Run:
```bash
supabase gen types typescript --local > src/types/database.types.ts
npm run typecheck && npm run lint
```
Expected: PASS (les types incluent `voyage_documents` ; le data layer + la route typecheckent). *(Comportement runtime couvert par l'e2e Task 5.)*

- [ ] **Step 4: Commit**

```bash
git add src/features/voyages/data/documents.ts "src/app/api/voyages/documents/[id]/route.ts" src/types/database.types.ts
git commit -m "feat(documents): actions (déposer/supprimer) + query + route de download déchiffrée"
```

---

### Task 4: UI (section Documents sur la fiche voyage) + i18n

**Files:**
- Modify: `messages/fr.json` (sous-clés `voyages.documents`)
- Create: `src/features/voyages/ui/DocumentUploadForm.tsx`
- Create: `src/features/voyages/ui/DocumentsList.tsx`
- Modify: `src/features/voyages/ui/VoyageDetail.tsx` (section Documents)

**Interfaces:**
- Consumes: `ajouterDocument`/`supprimerDocument` + `getVoyageDocuments` (`../data/documents`).
- Produces : section documents sur la fiche voyage. `data-testid` : `documents-section`, `document-row`, `document-upload-form`.

- [ ] **Step 1: i18n**

Modify `messages/fr.json` — dans le bloc `"voyages": { ... }`, ajouter une sous-clé `documents` (après une clé existante, virgules correctes) :
```json
    "documents": {
      "titre": "Documents",
      "deposer": "Déposer un document",
      "telecharger": "Télécharger",
      "supprimer": "Supprimer",
      "vide": "Aucun document.",
      "typeNonSupporte": "Type non supporté (PDF, JPEG, PNG, WebP)",
      "tropVolumineux": "Fichier trop volumineux (max 5 Mo)"
    }
```

- [ ] **Step 2: DocumentUploadForm.tsx**

Create `src/features/voyages/ui/DocumentUploadForm.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ajouterDocument } from "../data/documents";

export function DocumentUploadForm({ voyageId }: { voyageId: string }) {
  const t = useTranslations("voyages.documents");
  const [state, action, pending] = useActionState(ajouterDocument, undefined);
  return (
    <form action={action} data-testid="document-upload-form" className="flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="voyageId" value={voyageId} />
      <input name="file" type="file" required accept=".pdf,image/jpeg,image/png,image/webp" className="border p-2" />
      {state && "error" in state && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("deposer")}</button>
    </form>
  );
}
```

- [ ] **Step 3: DocumentsList.tsx**

Create `src/features/voyages/ui/DocumentsList.tsx` :
```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { supprimerDocument } from "../data/documents";

type Doc = { id: string; nom: string; mime_type: string; taille: number; created_at: string };

function ko(taille: number): string {
  return `${Math.max(1, Math.round(taille / 1024))} Ko`;
}

export function DocumentsList({ voyageId, documents }: { voyageId: string; documents: Doc[] }) {
  const t = useTranslations("voyages.documents");
  const [, supprimer] = useActionState(supprimerDocument, undefined);
  if (documents.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {documents.map((d) => (
        <li key={d.id} data-testid="document-row" className="flex items-center gap-2 border-b py-1">
          <span className="flex-1">{d.nom} <span className="text-gray-500 text-sm">({ko(d.taille)})</span></span>
          <a href={`/api/voyages/documents/${d.id}`} className="underline text-sm" download>{t("telecharger")}</a>
          <form action={supprimer}>
            <input type="hidden" name="documentId" value={d.id} />
            <input type="hidden" name="voyageId" value={voyageId} />
            <button type="submit" className="underline text-sm">{t("supprimer")}</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Intégrer dans VoyageDetail**

Modify `src/features/voyages/ui/VoyageDetail.tsx` :
(a) ajouter les imports en tête :
```tsx
import { getVoyageDocuments } from "../data/documents";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { DocumentsList } from "./DocumentsList";
```
(b) après le `const { voyage, reservations, membres, isOwner } = await getVoyageDetail(id);`, ajouter :
```tsx
  const documents = await getVoyageDocuments(voyage.id);
```
(c) insérer une nouvelle `<section>` juste avant la fermeture `</article>` :
```tsx
      <section data-testid="documents-section">
        <h2 className="font-semibold">{t("documents.titre")}</h2>
        <DocumentsList voyageId={voyage.id} documents={documents} />
        <DocumentUploadForm voyageId={voyage.id} />
      </section>
```
(`t` dans `VoyageDetail` est `getTranslations("voyages")` — `t("documents.titre")` résout la sous-clé.)

- [ ] **Step 5: Vérifier build (typecheck + lint + unit)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (typecheck/lint sans erreur ; tous les tests unitaires verts).

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json src/features/voyages/ui/DocumentUploadForm.tsx src/features/voyages/ui/DocumentsList.tsx src/features/voyages/ui/VoyageDetail.tsx
git commit -m "feat(documents): UI fiche voyage (liste + dépôt + téléchargement) + i18n"
```

---

### Task 5: e2e (dépôt / liste / download / suppression + 404 non-membre)

**Files:**
- Create: `e2e/documents.spec.ts`

**Interfaces:**
- Consumes : `/fr/voyages/[id]`, `/api/voyages/documents/[id]`, `data-testid` de Task 4. Voyage seed « Week-end à Rome » `11111111-2222-4333-8444-555555555555` (owner `client@vito.test`, partagé avec `agence@vito.test`). Non-membre : `free@vito.test`. Mot de passe `password123`. **`DOCUMENTS_ENCRYPTION_KEY` doit être présente** (en local via `.env.local`, en CI via `ci.yml` — cf. Task 1).

- [ ] **Step 1: Écrire l'e2e**

Create `e2e/documents.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";

const ROME = "11111111-2222-4333-8444-555555555555";
// PDF minimal valide
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/restos/);
}

test("déposer, lister, télécharger puis supprimer un document chiffré", async ({ page }) => {
  await login(page, "client@vito.test");
  await page.goto(`/fr/voyages/${ROME}`);

  const tag = `doc-${Date.now()}.pdf`;
  await page.getByTestId("document-upload-form").locator('input[type="file"]').setInputFiles({
    name: tag, mimeType: "application/pdf", buffer: PDF,
  });
  await page.getByTestId("document-upload-form").getByRole("button").click();

  // Apparaît dans la liste
  const row = page.getByTestId("document-row").filter({ hasText: tag });
  await expect(row).toBeVisible();

  // Téléchargement : la route renvoie 200 + content-type pdf, et le déchiffré == le PDF d'origine
  const href = await row.getByRole("link").getAttribute("href");
  expect(href).toBeTruthy();
  const resp = await page.request.get(href!);
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toContain("application/pdf");
  expect(Buffer.from(await resp.body()).equals(PDF)).toBe(true);

  // Suppression
  await row.getByRole("button").click();
  await expect(page.getByTestId("document-row").filter({ hasText: tag })).toHaveCount(0);
});

test("un non-membre obtient 404 sur la route de téléchargement", async ({ browser }) => {
  // client (membre) dépose un document et récupère son URL
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, "client@vito.test");
  await pageA.goto(`/fr/voyages/${ROME}`);
  const tag = `priv-${Date.now()}.pdf`;
  await pageA.getByTestId("document-upload-form").locator('input[type="file"]').setInputFiles({ name: tag, mimeType: "application/pdf", buffer: PDF });
  await pageA.getByTestId("document-upload-form").getByRole("button").click();
  const href = await pageA.getByTestId("document-row").filter({ hasText: tag }).getByRole("link").getAttribute("href");
  expect(href).toBeTruthy();

  // free@vito.test n'est pas membre du voyage Rome -> 404
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, "free@vito.test");
  const resp = await pageB.request.get(href!);
  expect(resp.status()).toBe(404);

  await ctxA.close();
  await ctxB.close();
});
```

- [ ] **Step 2: Appliquer le schéma + lancer l'e2e documents**

Run: `supabase db reset && npx playwright test e2e/documents.spec.ts --retries=0`
Expected: PASS (2 tests). (Nécessite `DOCUMENTS_ENCRYPTION_KEY` dans `.env.local` — cf. Task 1 Step 6.)

- [ ] **Step 3: Suite complète (non-régression)**

Run: `supabase db reset && npx playwright test --retries=0`
Expected: PASS (toute la suite + documents). (Un seul `db reset` immédiatement avant la suite complète.)

- [ ] **Step 4: Commit**

```bash
git add e2e/documents.spec.ts
git commit -m "test(documents): e2e (dépôt/liste/download/suppression + 404 non-membre)"
```

---

## Notes d'exécution

- **Ordre** : 1 (crypto+env) → 2 (DB) → 3 (data+route) → 4 (UI) → 5 (e2e). Task 3 dépend de 1+2 ; Task 4 de 3 ; Task 5 de tout.
- **`DOCUMENTS_ENCRYPTION_KEY`** : posée en dev (`.env.local`, non commité), CI (`ci.yml`, commité, clé de test) en Task 1. **Prod (Vercel)** : à définir à la clôture (le contrôleur le rappellera — secret env, pas dans le code).
- **Pas de `db push` prod** pendant l'implémentation.
- **Signaux e2e déterministes** : attendre `document-row` / la disparition de la ligne ; vérifier le download via `page.request.get` (status + content-type + octets) ; jamais `networkidle`.
- **Sécurité** : le chiffrement (clé param) est testé unitairement sans env ; la clé n'est lue qu'au runtime (`documentKey.ts`) ; la route s'appuie sur la RLS `can_access_voyage` (404 non-membre).
