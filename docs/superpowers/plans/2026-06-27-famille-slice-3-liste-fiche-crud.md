# Famille Slice 3 — Liste + fiche + CRUD proche + fusion foyer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le répertoire de proches (liste groupée par cercle, état vide, fiche personne en lecture avec documents masqués + route déchiffrée, CRUD personne) et fusionner l'onglet `/famille` (répertoire en héros + bloc « Foyer partagé » réutilisant l'existant).

**Architecture:** Tables `family_members`/`family_documents` déjà migrées (00019, RLS owner-only, `contenu_chiffre`). On ajoute : schéma zod, couche data (queries + server actions), composants UI présentational + formulaire, route API de déchiffrement (calquée sur voyages), pages App Router, i18n 4 locales. Le tunnel upload/OCR reste Slice 4 — ici les documents sont en lecture seule (seedés pour les tests).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (RLS), next-intl, Tailwind v4, Vitest, Playwright.

## Global Constraints

- Style **Le Carnet** : kit `PageHeader`/`SectionLabel`/`Card`/`Button`/`Badge`/`Avatar`, classes `rounded-card`/`rounded-control`, tokens existants. **Aucun nouveau token.**
- **RLS owner-only** (`user_id = auth.uid()`) déjà en place sur les 2 tables ; toute requête passe par `createServerSupabase()` (client RLS-scopé). Jamais de test RLS contre la prod.
- `contenu_chiffre` **jamais** sélectionné côté lecture liste/fiche ni renvoyé au client ; déchiffrement **serveur uniquement** dans la route API. `DOCUMENTS_ENCRYPTION_KEY` serveur only.
- Numéros de document **masqués par défaut** (`maskDocNumber`), révélés au tap.
- **Aucune chaîne en dur** : tout via `useTranslations("famille")` / `getTranslations`. Parité 4 locales (fr/en/it/es) garantie par `src/lib/i18n/messages-parity.test.ts`.
- Réutiliser le domaine Slice 2 : `expiryStatus`/`monthsUntil` (`@/features/famille/domain/expiry`), `maskDocNumber` (`@/features/famille/domain/mask`), `avatarColor` (`@/features/famille/domain/avatarColor`), et les composants `Avatar`/`RelationChip`/`ExpiryBadge`/`DocTypeIcon`.
- Réf. spec : `docs/superpowers/specs/2026-06-27-famille-slice-3-liste-fiche-crud-design.md`.
- **Vérification RLS via e2e cross-contexte** (convention Vito existante, cf. `e2e/documents.spec.ts`) — pas de harness SQL pgTAP (aucun dans le repo). Local/CI uniquement.

---

### Task 1: Schéma `procheInputSchema` (domaine, TDD)

**Files:**
- Modify: `src/features/famille/domain/schemas.ts`
- Test: `src/features/famille/domain/schemas.test.ts`

**Interfaces:**
- Produces: `procheInputSchema` (zod) + type `ProcheInput`. Champs : `first_name`, `last_name`, `relation`, `circle`, `phone?`, `email?`, `birth_date?`. Les optionnels acceptent `""`.

- [ ] **Step 1: Écrire le test qui échoue**

Append to `src/features/famille/domain/schemas.test.ts` (le fichier teste déjà `familleInputSchema`/`inviteSchema` ; ajouter un bloc) :

```ts
import { procheInputSchema } from "./schemas";

describe("procheInputSchema", () => {
  const base = { first_name: "Camille", last_name: "Durand", relation: "ami", circle: "proche" };

  it("accepte une entrée minimale valide", () => {
    expect(procheInputSchema.safeParse(base).success).toBe(true);
  });

  it("accepte les champs optionnels vides", () => {
    const r = procheInputSchema.safeParse({ ...base, phone: "", email: "", birth_date: "" });
    expect(r.success).toBe(true);
  });

  it("accepte des champs optionnels renseignés", () => {
    const r = procheInputSchema.safeParse({ ...base, phone: "+33611223344", email: "c@ex.fr", birth_date: "1990-05-12" });
    expect(r.success).toBe(true);
  });

  it("rejette une relation inconnue", () => {
    expect(procheInputSchema.safeParse({ ...base, relation: "cousin" }).success).toBe(false);
  });

  it("rejette un cercle inconnu", () => {
    expect(procheInputSchema.safeParse({ ...base, circle: "voisins" }).success).toBe(false);
  });

  it("rejette un e-mail non vide invalide", () => {
    expect(procheInputSchema.safeParse({ ...base, email: "pas-un-email" }).success).toBe(false);
  });

  it("rejette un prénom vide", () => {
    expect(procheInputSchema.safeParse({ ...base, first_name: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npm run test -- schemas`
Expected: FAIL (`procheInputSchema` n'existe pas).

- [ ] **Step 3: Implémenter le schéma**

Append to `src/features/famille/domain/schemas.ts` :

```ts
export const RELATIONS = ["conjoint", "enfant", "parent", "beau_parent", "ami", "autre"] as const;
export const CIRCLES = ["proche", "elargie", "amis"] as const;

export const procheInputSchema = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  relation: z.enum(RELATIONS),
  circle: z.enum(CIRCLES),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
});
export type ProcheInput = z.infer<typeof procheInputSchema>;
```

- [ ] **Step 4: Lancer le test + typecheck + lint**

Run: `npm run test -- schemas && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/famille/domain/schemas.ts src/features/famille/domain/schemas.test.ts
git commit -m "feat(famille): procheInputSchema + RELATIONS/CIRCLES (TDD)"
```

---

### Task 2: Couche data — `getProches` / `getProche` + actions CRUD

**Files:**
- Modify: `src/features/famille/data/queries.ts`
- Modify: `src/features/famille/data/actions.ts`

**Interfaces:**
- Consumes: `procheInputSchema`/`ProcheInput` (Task 1), `avatarColor` (`@/features/famille/domain/avatarColor`), `expiryStatus` (`@/features/famille/domain/expiry`).
- Produces:
  - `getProches(): Promise<Proche[]>` où `Proche = { id: string; first_name: string; last_name: string; relation: string; circle: string; avatar_color: string | null; doc_count: number; urgency: "expired" | "soon" | "valid" | null; urgency_months: number | null }`.
  - `getProche(id: string): Promise<{ proche: ProcheDetail; documents: DocMeta[] } | null>` où `ProcheDetail = { id, first_name, last_name, relation, circle, avatar_color, phone, email, birth_date }` (tous `string | null` sauf id/first/last/relation/circle) et `DocMeta = { id: string; doc_type: string; doc_number: string | null; country: string | null; holder_name: string | null; issue_date: string | null; expiry_date: string | null; mime_type: string }`.
  - Server actions : `creerProche(_prev, formData)`, `modifierProche(_prev, formData)`, `supprimerProche(_prev, formData)` — retour `{ error: string } | never` (succès → `redirect`).

- [ ] **Step 1: Implémenter les queries**

Append to `src/features/famille/data/queries.ts` :

```ts
import { expiryStatus, monthsUntil } from "../domain/expiry";

export type Proche = {
  id: string;
  first_name: string;
  last_name: string;
  relation: string;
  circle: string;
  avatar_color: string | null;
  doc_count: number;
  urgency: "expired" | "soon" | "valid" | null;
  urgency_months: number | null;
};

export type DocMeta = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  country: string | null;
  holder_name: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  mime_type: string;
};

export type ProcheDetail = {
  id: string;
  first_name: string;
  last_name: string;
  relation: string;
  circle: string;
  avatar_color: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
};

// pire statut d'expiration + mois restants si "soon" (expired > soon > valid > null)
function worstUrgency(dates: (string | null)[], now: Date): { urgency: Proche["urgency"]; urgency_months: number | null } {
  const rank = { expired: 3, soon: 2, valid: 1 } as const;
  let worst: Proche["urgency"] = null;
  let soonMonths: number | null = null;
  for (const d of dates) {
    const s = expiryStatus(d, now);
    if (!s) continue;
    if (worst === null || rank[s] > rank[worst]) worst = s;
    if (s === "soon" && d) {
      const m = monthsUntil(d, now);
      if (soonMonths === null || m < soonMonths) soonMonths = m;
    }
  }
  return { urgency: worst, urgency_months: worst === "soon" ? soonMonths : null };
}

export async function getProches(): Promise<Proche[]> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, relation, circle, avatar_color, family_documents(expiry_date)")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (error) throw error;
  const now = new Date();
  return (data ?? []).map((m) => {
    const docs = (m.family_documents ?? []) as { expiry_date: string | null }[];
    const { urgency, urgency_months } = worstUrgency(docs.map((d) => d.expiry_date), now);
    return {
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      relation: m.relation,
      circle: m.circle,
      avatar_color: m.avatar_color,
      doc_count: docs.length,
      urgency,
      urgency_months,
    };
  });
}

export async function getProche(id: string): Promise<{ proche: ProcheDetail; documents: DocMeta[] } | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: m, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, relation, circle, avatar_color, phone, email, birth_date")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!m) return null;
  const { data: docs, error: dErr } = await supabase
    .from("family_documents")
    .select("id, doc_type, doc_number, country, holder_name, issue_date, expiry_date, mime_type")
    .eq("member_id", id)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (dErr) throw dErr;
  return { proche: m as ProcheDetail, documents: (docs ?? []) as DocMeta[] };
}
```

- [ ] **Step 2: Implémenter les actions CRUD**

Append to `src/features/famille/data/actions.ts`. Ajouter en tête du fichier l'import `redirect` et le schéma :

```ts
import { redirect } from "next/navigation";
import { avatarColor } from "../domain/avatarColor";
import { procheInputSchema } from "../domain/schemas";
```

Puis les actions :

```ts
function clean(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function creerProche(_prev: unknown, formData: FormData) {
  const parsed = procheInputSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    relation: formData.get("relation"),
    circle: formData.get("circle"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    birth_date: formData.get("birth_date") ?? "",
  });
  if (!parsed.success) return { error: "Champs invalides" };
  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };
  const p = parsed.data;
  const { data, error } = await supabase
    .from("family_members")
    .insert({
      user_id: uid,
      first_name: p.first_name,
      last_name: p.last_name,
      relation: p.relation,
      circle: p.circle,
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
      birth_date: clean(formData.get("birth_date")),
      avatar_color: avatarColor(`${p.first_name} ${p.last_name}`),
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Création échouée" };
  revalidatePath("/famille");
  redirect(`/famille/proches/${data.id}`);
}

export async function modifierProche(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const parsed = procheInputSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    relation: formData.get("relation"),
    circle: formData.get("circle"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    birth_date: formData.get("birth_date") ?? "",
  });
  if (!parsed.success) return { error: "Champs invalides" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const p = parsed.data;
  const { data, error } = await supabase
    .from("family_members")
    .update({
      first_name: p.first_name,
      last_name: p.last_name,
      relation: p.relation,
      circle: p.circle,
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
      birth_date: clean(formData.get("birth_date")),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Modification échouée" };
  if (!data) return { error: "Introuvable" };
  revalidatePath("/famille");
  revalidatePath(`/famille/proches/${id}`);
  redirect(`/famille/proches/${id}`);
}

export async function supprimerProche(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Entrée invalide" };
  const supabase = await createServerSupabase();
  if (!(await userId(supabase))) return { error: "Non authentifié" };
  const { error } = await supabase.from("family_members").delete().eq("id", id);
  if (error) return { error: "Suppression échouée" };
  revalidatePath("/famille");
  redirect("/famille");
}
```

- [ ] **Step 3: typecheck + lint + test (régénérer types si besoin)**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS. (Les types Supabase de `family_members`/`family_documents` existent déjà — régénérés en Slice 1. Si la sélection nichée `family_documents(expiry_date)` ne type pas, vérifier que la FK `member_id` est bien dans `database.types.ts`.)

- [ ] **Step 4: Commit**

```bash
git add src/features/famille/data/queries.ts src/features/famille/data/actions.ts
git commit -m "feat(famille): data layer proches (getProches/getProche + creer/modifier/supprimer)"
```

---

### Task 3: Route déchiffrée + seed document + e2e route

**Files:**
- Create: `src/app/api/famille/documents/[id]/route.ts`
- Modify: `supabase/seed.sql`
- Test: `e2e/famille-documents.spec.ts`

**Interfaces:**
- Consumes: `decryptDocument` (`@/lib/crypto/documents`), `getDocumentKey` (`@/lib/crypto/documentKey`).
- Produces: `GET /api/famille/documents/[id]` → 200 (octet déchiffré, owner) / 404 (non-owner ou inconnu) / 500 (déchiffrement).

- [ ] **Step 1: Créer la route (calque de voyages)**

Create `src/app/api/famille/documents/[id]/route.ts` :

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  // RLS owner-only : un non-owner n'obtient aucune ligne -> 404 (aucune fuite).
  const { data, error } = await supabase
    .from("family_documents")
    .select("doc_type, mime_type, contenu_chiffre")
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
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
```

- [ ] **Step 2: Seeder un proche + un document chiffré (client@vito.test)**

Append to `supabase/seed.sql` (le blob base64 est un PDF minimal chiffré AES-256-GCM avec la clé de test `0123…`, IV embarqué — déchiffrable tel quel) :

```sql
-- Famille : répertoire de proches (Slice 3) pour client@vito.test (11111111-1111-1111-1111-111111111111)
insert into public.family_members (id, user_id, first_name, last_name, relation, circle, avatar_color) values
  ('f1111111-1111-4111-8111-111111111111', '11111111-1111-1111-1111-111111111111', 'Camille', 'Durand', 'enfant', 'proche', '#6B7A8F');

insert into public.family_documents (id, user_id, member_id, doc_type, doc_number, country, holder_name, issue_date, expiry_date, contenu_chiffre, mime_type, taille) values
  ('d1111111-1111-4111-8111-111111111111', '11111111-1111-1111-1111-111111111111', 'f1111111-1111-4111-8111-111111111111',
   'passeport', '19FR99892', 'FR', 'Camille Durand', '2019-03-01', '2029-03-01',
   'z8qW2rZIWU40NFWX7FWy65T8NMMW06ozKgn3AQrM2dJLSJXyRoZFRHm9zmXN2eETafYyNJRDZ6TqEGgpEfBAGi8dee3//rtH',
   'application/pdf', 48);
```

- [ ] **Step 3: e2e route (200 owner / 404 non-owner)**

Create `e2e/famille-documents.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

const DOC_ID = "d1111111-1111-4111-8111-111111111111";

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("l'owner télécharge le document déchiffré (200, pdf)", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.get(`/api/famille/documents/${DOC_ID}`);
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toContain("application/pdf");
  expect(Buffer.from(await resp.body()).toString()).toContain("%PDF-1.4");
});

test("un non-owner obtient 404 (aucune fuite) et ne voit pas le proche", async ({ page }) => {
  await login(page, "free@vito.test");
  const resp = await page.request.get(`/api/famille/documents/${DOC_ID}`);
  expect(resp.status()).toBe(404);
  // RLS family_members : free ne voit pas le proche seedé de client (« Camille Durand »)
  await page.goto("/fr/famille");
  await expect(page.getByText("Camille Durand")).toHaveCount(0);
});
```

- [ ] **Step 4: Lancer e2e (reset pour réappliquer le seed)**

Run: `supabase db reset && npx playwright test famille-documents --retries=0`
Expected: 2 tests PASS. (Flake connu `liste_items`/anon → relancer une fois si besoin.)

- [ ] **Step 5: typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/app/api/famille/documents/[id]/route.ts supabase/seed.sql e2e/famille-documents.spec.ts
git commit -m "feat(famille): route document déchiffrée + seed + e2e (200 owner / 404 non-owner)"
```

---

### Task 4: Composants présentational + i18n

**Files:**
- Create: `src/features/famille/ui/ProchesList.tsx`
- Create: `src/features/famille/ui/ProchesEmptyState.tsx`
- Create: `src/features/famille/ui/FichePersonne.tsx`
- Create: `src/features/famille/ui/DocumentRow.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Consumes: `Proche`/`ProcheDetail`/`DocMeta` (Task 2) ; `Avatar`/`RelationChip`/`ExpiryBadge`/`DocTypeIcon` (Slice 2) ; `maskDocNumber`, `expiryStatus`/`monthsUntil` ; `formatDay` (`@/lib/format/date`) ; kit `Card`/`Button`/`SectionLabel`.
- Produces: `ProchesList`, `ProchesEmptyState`, `FichePersonne`, `DocumentRow`.

- [ ] **Step 1: Ajouter les clés i18n (4 locales)**

Dans chaque `messages/<loc>.json`, sous l'objet `famille`, ajouter ces sous-objets (valeurs FR ci-dessous ; traduire pour en/it/es). **Ne pas dupliquer** les clés Slice 2 existantes (`relations`/`docTypes`/`expiry`).

`messages/fr.json` → `famille` :
```json
"proches": { "titre": "Mes proches", "ajouter": "Ajouter un proche", "vide": "Aucun proche pour l'instant", "videTexte": "Ajoute les personnes dont tu gardes les papiers à portée de main.", "documentsCount": "{n, plural, =0 {Aucun document} one {# document} other {# documents}}" },
"circles": { "proche": "Proches", "elargie": "Famille élargie", "amis": "Amis" },
"fiche": { "contacts": "Contacts", "naissance": "Naissance", "documents": "Documents", "aucunDocument": "Aucun document enregistré.", "voirDocument": "Voir le document", "modifier": "Modifier", "revelerNumero": "Révéler le numéro" },
"form": { "prenom": "Prénom", "nom": "Nom", "relation": "Relation", "cercle": "Cercle", "telephone": "Téléphone", "email": "E-mail", "naissance": "Date de naissance", "enregistrer": "Enregistrer", "supprimer": "Supprimer", "confirmSuppr": "Supprimer ce proche et ses documents ?" }
```

`messages/en.json` :
```json
"proches": { "titre": "My circle", "ajouter": "Add a person", "vide": "No one yet", "videTexte": "Add the people whose documents you keep close at hand.", "documentsCount": "{n, plural, =0 {No documents} one {# document} other {# documents}}" },
"circles": { "proche": "Close family", "elargie": "Extended family", "amis": "Friends" },
"fiche": { "contacts": "Contacts", "naissance": "Birth", "documents": "Documents", "aucunDocument": "No document on file.", "voirDocument": "View document", "modifier": "Edit", "revelerNumero": "Reveal number" },
"form": { "prenom": "First name", "nom": "Last name", "relation": "Relationship", "cercle": "Circle", "telephone": "Phone", "email": "Email", "naissance": "Date of birth", "enregistrer": "Save", "supprimer": "Delete", "confirmSuppr": "Delete this person and their documents?" }
```

`messages/it.json` :
```json
"proches": { "titre": "I miei cari", "ajouter": "Aggiungi una persona", "vide": "Ancora nessuno", "videTexte": "Aggiungi le persone di cui conservi i documenti a portata di mano.", "documentsCount": "{n, plural, =0 {Nessun documento} one {# documento} other {# documenti}}" },
"circles": { "proche": "Famiglia stretta", "elargie": "Famiglia allargata", "amis": "Amici" },
"fiche": { "contacts": "Contatti", "naissance": "Nascita", "documents": "Documenti", "aucunDocument": "Nessun documento registrato.", "voirDocument": "Vedi il documento", "modifier": "Modifica", "revelerNumero": "Mostra il numero" },
"form": { "prenom": "Nome", "nom": "Cognome", "relation": "Relazione", "cercle": "Cerchia", "telephone": "Telefono", "email": "E-mail", "naissance": "Data di nascita", "enregistrer": "Salva", "supprimer": "Elimina", "confirmSuppr": "Eliminare questa persona e i suoi documenti?" }
```

`messages/es.json` :
```json
"proches": { "titre": "Mis allegados", "ajouter": "Añadir una persona", "vide": "Aún no hay nadie", "videTexte": "Añade a las personas cuyos documentos guardas a mano.", "documentsCount": "{n, plural, =0 {Sin documentos} one {# documento} other {# documentos}}" },
"circles": { "proche": "Familia cercana", "elargie": "Familia extensa", "amis": "Amigos" },
"fiche": { "contacts": "Contactos", "naissance": "Nacimiento", "documents": "Documentos", "aucunDocument": "Ningún documento registrado.", "voirDocument": "Ver el documento", "modifier": "Editar", "revelerNumero": "Mostrar el número" },
"form": { "prenom": "Nombre", "nom": "Apellido", "relation": "Relación", "cercle": "Círculo", "telephone": "Teléfono", "email": "Correo", "naissance": "Fecha de nacimiento", "enregistrer": "Guardar", "supprimer": "Eliminar", "confirmSuppr": "¿Eliminar a esta persona y sus documentos?" }
```

- [ ] **Step 2: Vérifier la parité i18n**

Run: `npm run test -- messages-parity`
Expected: PASS (4 locales, mêmes clés).

- [ ] **Step 3: `ProchesEmptyState`**

Create `src/features/famille/ui/ProchesEmptyState.tsx` :

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/features/shared/ui/Button";

export async function ProchesEmptyState() {
  const t = await getTranslations("famille");
  return (
    <div data-testid="proches-empty" className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-10 text-center">
      <p className="font-serif text-2xl text-ink">{t("proches.vide")}</p>
      <p className="max-w-sm text-muted">{t("proches.videTexte")}</p>
      <Link href="/famille/proches/nouveau"><Button>{t("proches.ajouter")}</Button></Link>
    </div>
  );
}
```

- [ ] **Step 4: `ProchesList`**

Create `src/features/famille/ui/ProchesList.tsx` :

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Proche } from "../data/queries";
import { Avatar } from "@/features/shared/ui/Avatar";
import { Card } from "@/features/shared/ui/Card";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { RelationChip } from "./RelationChip";
import { ExpiryBadge } from "./ExpiryBadge";
import { CIRCLES } from "../domain/schemas";

export async function ProchesList({ proches }: { proches: Proche[] }) {
  const t = await getTranslations("famille");
  return (
    <div className="flex flex-col gap-6">
      {CIRCLES.map((circle) => {
        const group = proches.filter((p) => p.circle === circle);
        if (group.length === 0) return null;
        return (
          <section key={circle} className="flex flex-col gap-3">
            <SectionLabel>{t(`circles.${circle}`)}</SectionLabel>
            <ul className="flex flex-col gap-2">
              {group.map((p) => (
                <li key={p.id} data-testid="proche-row">
                  <Link href={`/famille/proches/${p.id}`} className="block">
                    <Card className="flex items-center gap-3">
                      <Avatar name={`${p.first_name} ${p.last_name}`} size="lg" color={p.avatar_color ?? undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-lg text-ink">{p.first_name} {p.last_name}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <RelationChip relation={p.relation} />
                          <span className="text-sm text-muted">{t("proches.documentsCount", { n: p.doc_count })}</span>
                        </div>
                      </div>
                      {(p.urgency === "expired" || p.urgency === "soon") && <ExpiryBadge status={p.urgency} monthsLeft={p.urgency_months ?? undefined} />}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: `DocumentRow` (client, masquage + révéler au tap)**

Create `src/features/famille/ui/DocumentRow.tsx` :

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DocMeta } from "../data/queries";
import { DocTypeIcon } from "./DocTypeIcon";
import { ExpiryBadge } from "./ExpiryBadge";
import { maskDocNumber } from "../domain/mask";
import { expiryStatus, monthsUntil } from "../domain/expiry";

export function DocumentRow({ doc }: { doc: DocMeta }) {
  const t = useTranslations("famille");
  const [revealed, setRevealed] = useState(false);
  const status = expiryStatus(doc.expiry_date, new Date());
  return (
    <li data-testid="document-row" className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
      <DocTypeIcon docType={doc.doc_type} />
      <div className="flex-1 min-w-0">
        <div className="text-ink">{t(`docTypes.${doc.doc_type}`)}</div>
        {doc.doc_number && (
          <button type="button" onClick={() => setRevealed((v) => !v)} aria-label={t("fiche.revelerNumero")} className="text-sm text-muted tabular-nums">
            {revealed ? doc.doc_number : maskDocNumber(doc.doc_number)}
          </button>
        )}
      </div>
      {status && status !== "valid" && <ExpiryBadge status={status} monthsLeft={doc.expiry_date ? monthsUntil(doc.expiry_date, new Date()) : undefined} />}
      <a href={`/api/famille/documents/${doc.id}`} target="_blank" rel="noopener" className="text-sm font-medium text-accent">{t("fiche.voirDocument")}</a>
    </li>
  );
}
```

- [ ] **Step 6: `FichePersonne`**

Create `src/features/famille/ui/FichePersonne.tsx` :

```tsx
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import type { ProcheDetail, DocMeta } from "../data/queries";
import { Avatar } from "@/features/shared/ui/Avatar";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Button } from "@/features/shared/ui/Button";
import { RelationChip } from "./RelationChip";
import { DocumentRow } from "./DocumentRow";
import { formatDay } from "@/lib/format/date";

export async function FichePersonne({ proche, documents }: { proche: ProcheDetail; documents: DocMeta[] }) {
  const t = await getTranslations("famille");
  const locale = await getLocale();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Avatar name={`${proche.first_name} ${proche.last_name}`} size="xl" color={proche.avatar_color ?? undefined} />
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-ink">{proche.first_name} {proche.last_name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <RelationChip relation={proche.relation} />
            <span className="text-sm text-muted">{t(`circles.${proche.circle}`)}</span>
          </div>
        </div>
        <Link href={`/famille/proches/${proche.id}/modifier`}><Button variant="ghost">{t("fiche.modifier")}</Button></Link>
      </header>

      {(proche.phone || proche.email || proche.birth_date) && (
        <section className="flex flex-col gap-1">
          <SectionLabel>{t("fiche.contacts")}</SectionLabel>
          {proche.phone && <p className="text-ink">{proche.phone}</p>}
          {proche.email && <p className="text-ink">{proche.email}</p>}
          {proche.birth_date && <p className="text-muted">{t("fiche.naissance")} · {formatDay(proche.birth_date, locale)}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>{t("fiche.documents")}</SectionLabel>
        {documents.length === 0 ? (
          <p className="text-muted">{t("fiche.aucunDocument")}</p>
        ) : (
          <ul className="flex flex-col gap-2">{documents.map((d) => <DocumentRow key={d.id} doc={d} />)}</ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (parité i18n verte).
```bash
git add src/features/famille/ui/ProchesList.tsx src/features/famille/ui/ProchesEmptyState.tsx src/features/famille/ui/FichePersonne.tsx src/features/famille/ui/DocumentRow.tsx messages/
git commit -m "feat(famille): composants proches (liste/vide/fiche/document) + i18n 4 locales"
```

---

### Task 5: Formulaire + pages + fusion `/famille` (+ e2e CRUD)

**Files:**
- Create: `src/features/famille/ui/ProcheForm.tsx`
- Create: `src/app/[locale]/(app)/famille/proches/nouveau/page.tsx`
- Create: `src/app/[locale]/(app)/famille/proches/[id]/page.tsx`
- Create: `src/app/[locale]/(app)/famille/proches/[id]/modifier/page.tsx`
- Modify: `src/app/[locale]/(app)/famille/page.tsx`
- Test: `e2e/famille.spec.ts` (ajouter un test ; ne pas casser l'existant)

**Interfaces:**
- Consumes: `creerProche`/`modifierProche`/`supprimerProche` (Task 2), `getProches`/`getProche` (Task 2), `ProcheDetail` ; `ProchesList`/`ProchesEmptyState`/`FichePersonne` (Task 4) ; `RELATIONS`/`CIRCLES` (Task 1) ; existant `getMaFamille`/`getFamilleRestos`, `MembresList`/`InviteForm`/`FamilleRestos`.

- [ ] **Step 1: `ProcheForm` (client, création + édition)**

Create `src/features/famille/ui/ProcheForm.tsx` :

```tsx
"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ProcheDetail } from "../data/queries";
import { creerProche, modifierProche, supprimerProche } from "../data/actions";
import { RELATIONS, CIRCLES } from "../domain/schemas";
import { Button } from "@/features/shared/ui/Button";

const FIELD = "rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";

export function ProcheForm({ mode, initial }: { mode: "create" | "edit"; initial?: ProcheDetail }) {
  const t = useTranslations("famille");
  const [state, action, pending] = useActionState(mode === "create" ? creerProche : modifierProche, undefined);
  const [, supprimer] = useActionState(supprimerProche, undefined);
  return (
    <div className="flex max-w-md flex-col gap-4">
      <form action={action} data-testid="proche-form" className="flex flex-col gap-3">
        {mode === "edit" && <input type="hidden" name="id" value={initial!.id} />}
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.prenom")}</span>
          <input name="first_name" required defaultValue={initial?.first_name ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.nom")}</span>
          <input name="last_name" required defaultValue={initial?.last_name ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.relation")}</span>
          <select name="relation" defaultValue={initial?.relation ?? "ami"} className={FIELD}>
            {RELATIONS.map((r) => <option key={r} value={r}>{t(`relations.${r}`)}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.cercle")}</span>
          <select name="circle" defaultValue={initial?.circle ?? "proche"} className={FIELD}>
            {CIRCLES.map((c) => <option key={c} value={c}>{t(`circles.${c}`)}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.telephone")}</span>
          <input name="phone" type="tel" defaultValue={initial?.phone ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.email")}</span>
          <input name="email" type="email" defaultValue={initial?.email ?? ""} className={FIELD} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm text-muted">{t("form.naissance")}</span>
          <input name="birth_date" type="date" defaultValue={initial?.birth_date ?? ""} className={FIELD} /></label>
        {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
        <Button type="submit" pending={pending}>{t("form.enregistrer")}</Button>
      </form>
      {mode === "edit" && (
        <form action={supprimer} onSubmit={(e) => { if (!confirm(t("form.confirmSuppr"))) e.preventDefault(); }}>
          <input type="hidden" name="id" value={initial!.id} />
          <Button type="submit" variant="ghost" className="text-danger">{t("form.supprimer")}</Button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Pages proches (nouveau / fiche / modifier)**

Create `src/app/[locale]/(app)/famille/proches/nouveau/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { ProcheForm } from "@/features/famille/ui/ProcheForm";

export default async function NouveauProchePage() {
  const t = await getTranslations("famille");
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("proches.ajouter")} />
      <ProcheForm mode="create" />
    </main>
  );
}
```

Create `src/app/[locale]/(app)/famille/proches/[id]/page.tsx` :

```tsx
import { notFound } from "next/navigation";
import { getProche } from "@/features/famille/data/queries";
import { FichePersonne } from "@/features/famille/ui/FichePersonne";

export default async function FichePersonnePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProche(id);
  if (!data) notFound();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <FichePersonne proche={data.proche} documents={data.documents} />
    </main>
  );
}
```

Create `src/app/[locale]/(app)/famille/proches/[id]/modifier/page.tsx` :

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProche } from "@/features/famille/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { ProcheForm } from "@/features/famille/ui/ProcheForm";

export default async function ModifierProchePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("famille");
  const data = await getProche(id);
  if (!data) notFound();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("fiche.modifier")} />
      <ProcheForm mode="edit" initial={data.proche} />
    </main>
  );
}
```

- [ ] **Step 3: Fusionner `/famille/page.tsx`**

Replace `src/app/[locale]/(app)/famille/page.tsx` :

```tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getMaFamille, getFamilleRestos, getProches } from "@/features/famille/data/queries";
import { FamilleForm } from "@/features/famille/ui/FamilleForm";
import { InviteForm } from "@/features/famille/ui/InviteForm";
import { MembresList } from "@/features/famille/ui/MembresList";
import { FamilleRestos } from "@/features/famille/ui/FamilleRestos";
import { ProchesList } from "@/features/famille/ui/ProchesList";
import { ProchesEmptyState } from "@/features/famille/ui/ProchesEmptyState";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Button } from "@/features/shared/ui/Button";

export default async function FamillePage() {
  const t = await getTranslations("famille");
  const proches = await getProches();
  const ma = await getMaFamille();

  return (
    <main className="flex flex-col gap-8 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("proches.titre")} />

      {/* Répertoire de proches (héros) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionLabel>{t("proches.titre")}</SectionLabel>
          <Link href="/famille/proches/nouveau"><Button className="text-sm py-1.5">{t("proches.ajouter")}</Button></Link>
        </div>
        {proches.length === 0 ? <ProchesEmptyState /> : <ProchesList proches={proches} />}
      </section>

      {/* Foyer partagé (bloc réutilisant l'existant) */}
      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <SectionLabel>{t("membres")}</SectionLabel>
        {!ma ? <FamilleForm /> : <FoyerPartage ma={ma} />}
      </section>
    </main>
  );
}

type MaFamille = NonNullable<Awaited<ReturnType<typeof getMaFamille>>>;

async function FoyerPartage({ ma }: { ma: MaFamille }) {
  const t = await getTranslations("famille");
  const restos = await getFamilleRestos(ma.famille.id);
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const currentProfileId = auth.user?.id ?? "";
  return (
    <div className="flex flex-col gap-4">
      <MembresList membres={ma.membres} isOwner={ma.isOwner} currentProfileId={currentProfileId} />
      {ma.isOwner && <InviteForm />}
      <SectionLabel>{t("restos")}</SectionLabel>
      <FamilleRestos restos={restos} />
    </div>
  );
}
```

- [ ] **Step 4: e2e CRUD proche**

Append to `e2e/famille.spec.ts` (nouveau `test`, sans toucher l'existant) :

```ts
test("ajouter, voir, modifier puis supprimer un proche", async ({ page }) => {
  await login(page, "premium@vito.test");
  await page.goto("/fr/famille");
  await page.getByRole("link", { name: "Ajouter un proche" }).first().click();
  await expect(page).toHaveURL(/\/famille\/proches\/nouveau/);

  await page.getByTestId("proche-form").locator('input[name="first_name"]').fill("Léa");
  await page.getByTestId("proche-form").locator('input[name="last_name"]').fill("Martin");
  await page.getByTestId("proche-form").locator('select[name="circle"]').selectOption("amis");
  await page.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();

  // Redirigé vers la fiche
  await expect(page.getByRole("heading", { name: "Léa Martin" })).toBeVisible();

  // Visible dans la liste, section Amis
  await page.goto("/fr/famille");
  await expect(page.getByTestId("proche-row").filter({ hasText: "Léa Martin" })).toBeVisible();

  // Modifier
  await page.getByTestId("proche-row").filter({ hasText: "Léa Martin" }).click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByTestId("proche-form").locator('input[name="last_name"]').fill("Bernard");
  await page.getByTestId("proche-form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { name: "Léa Bernard" })).toBeVisible();

  // Supprimer (confirm auto-accepté)
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page).toHaveURL(/\/fr\/famille$/);
  await expect(page.getByTestId("proche-row").filter({ hasText: "Léa Bernard" })).toHaveCount(0);
});
```

- [ ] **Step 5: Lancer e2e ciblée + typecheck + lint**

Run: `supabase db reset && npx playwright test famille --retries=0 && npm run typecheck && npm run lint`
Expected: e2e famille (existant + nouveau) PASS ; typecheck/lint PASS. (Flake `liste_items`/anon → relancer une fois.)

- [ ] **Step 6: Commit**

```bash
git add src/features/famille/ui/ProcheForm.tsx "src/app/[locale]/(app)/famille" e2e/famille.spec.ts
git commit -m "feat(famille): formulaire proche + pages (nouveau/fiche/modifier) + fusion /famille + e2e CRUD"
```

---

### Task 6: Non-régression complète + build

**Files:** aucun (vérification).

- [ ] **Step 1: Suite complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e **verte** + build OK. (Flake connu `liste_items`/anon → relancer une fois : `npx playwright test <fichier> --retries=0`.)

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(famille): correctifs non-régression Slice 3" # seulement si nécessaire
```

---

## Notes d'exécution

- **Aucune migration nouvelle** (00019 déjà en prod). Merge standard après CI « quality » verte.
- **Filet** : le foyer partagé existant n'est pas modifié dans sa logique (queries `getMaFamille`/`getFamilleRestos` et composants `MembresList`/`InviteForm`/`FamilleRestos` réutilisés tels quels) — seul `page.tsx` est réorganisé. L'e2e foyer existant doit rester vert.
- **Sécurité** : `contenu_chiffre` n'est sélectionné que dans la route API ; jamais dans `getProche`/`getProches`. Numéros masqués par défaut côté `DocumentRow`.
