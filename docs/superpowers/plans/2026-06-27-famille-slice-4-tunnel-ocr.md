# Famille Slice 4 — Tunnel d'ajout de document + OCR Anthropic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le tunnel d'ajout d'un document d'identité à un proche (stepper A→D : type → upload chiffré → lecture OCR Anthropic → vérification pré-remplie → insertion), avec provider OCR mocké en test.

**Architecture:** Provider OCR (réel Anthropic / mock) sélectionné par clé d'env ; route API de lecture qui ne persiste rien ; action serveur `creerDocument` qui chiffre + insère au submit (jamais d'auto-save) ; composant client `DocumentTunnel` portant le fichier en mémoire de B à D.

**Tech Stack:** Next.js 16 App Router, TS strict, Supabase (RLS), `@anthropic-ai/sdk` (nouvelle dép.), next-intl, AES-256-GCM, Vitest, Playwright.

## Global Constraints

- **Jamais d'auto-save** : le document n'est inséré qu'au submit de l'étape D. Le `File` est porté côté client (state) de B à D ; envoyé à la route OCR (lecture seule) puis à l'action (chiffre+insère).
- **Sécurité** : `ANTHROPIC_API_KEY` + `DOCUMENTS_ENCRYPTION_KEY` **server-only**, jamais exposées ni loggées ; contenu du fichier jamais loggé. Validation **mime ∈ {image/jpeg,image/png,application/pdf} + taille ≤ 10 Mo** côté **client (B) ET serveur (route + action)** — le serveur fait foi. `contenu_chiffre` chiffré au repos, jamais renvoyé au client. RLS owner-only : insert avec `user_id = auth.uid()`.
- **OCR mocké en test** : `getOcrProvider()` renvoie le mock quand `ANTHROPIC_API_KEY` est absente (cas CI/e2e) → l'API Anthropic n'est **jamais** appelée dans les tests.
- Modèle OCR réel = **`claude-sonnet-4-6`**. Fallback manuel basique (échec OCR → étape D vide + « saisie manuelle »).
- **Aucune chaîne UI en dur** : `useTranslations("famille")` / `getTranslations`. Parité 4 locales (`src/lib/i18n/messages-parity.test.ts`).
- `Link`/`redirect` **locale-aware** depuis `@/lib/i18n/routing` (jamais `next/link` ni `next/navigation` redirect — convention Vito).
- Style Le Carnet, aucun nouveau token. AGENTS.md : **consulter `node_modules/next/dist/docs/`** avant d'écrire du code de route handler / server action / form action (Next 16 diffère).
- Réf. spec : `docs/superpowers/specs/2026-06-27-famille-slice-4-tunnel-ocr-design.md`. Aucune migration (00019 déjà en prod).

---

### Task 1: Dépendance `@anthropic-ai/sdk` + provider OCR (réel + mock)

**Files:**
- Modify: `package.json`, `package-lock.json` (install)
- Create: `src/lib/services/ocr/types.ts`
- Create: `src/lib/services/ocr/index.ts`
- Create: `src/lib/services/ocr/anthropic.ts`
- Create: `src/lib/services/ocr/mock.ts`
- Test: `src/lib/services/ocr/mock.test.ts`

**Interfaces:**
- Produces: `OcrFields`, `OcrResult`, `OcrProvider` (types) ; `getOcrProvider(): OcrProvider` ; `MockOcrProvider`, `AnthropicOcrProvider`.

- [ ] **Step 1: Installer le SDK**

Run: `npm install @anthropic-ai/sdk`
Expected: ajout dans `dependencies` + lockfile mis à jour.

- [ ] **Step 2: Types**

Create `src/lib/services/ocr/types.ts` :

```ts
export type OcrFields = {
  doc_number: string | null;
  country: string | null;
  holder_name: string | null;
  issue_date: string | null; // ISO YYYY-MM-DD ou null
  expiry_date: string | null; // ISO YYYY-MM-DD ou null
  issue_place: string | null;
};

export type OcrResult = { fields: OcrFields; raw: unknown };

export interface OcrProvider {
  read(bytes: Buffer, mimeType: string, docType: string): Promise<OcrResult>;
}

export const EMPTY_FIELDS: OcrFields = {
  doc_number: null, country: null, holder_name: null,
  issue_date: null, expiry_date: null, issue_place: null,
};
```

- [ ] **Step 3: Mock provider + test (TDD)**

Create `src/lib/services/ocr/mock.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { MockOcrProvider } from "./mock";

describe("MockOcrProvider", () => {
  it("renvoie des champs déterministes pour un passeport", async () => {
    const r = await new MockOcrProvider().read(Buffer.from("x"), "application/pdf", "passeport");
    expect(r.fields.doc_number).toBeTruthy();
    expect(r.fields.country).toBe("France");
    expect(r.fields.expiry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.raw).toEqual({ mock: true, docType: "passeport" });
  });

  it("renvoie le docType dans raw", async () => {
    const r = await new MockOcrProvider().read(Buffer.from("x"), "image/png", "visa");
    expect(r.raw).toEqual({ mock: true, docType: "visa" });
  });
});
```

Run: `npm run test -- ocr/mock` → FAIL (module absent).

Create `src/lib/services/ocr/mock.ts` :

```ts
import type { OcrProvider, OcrResult } from "./types";

export class MockOcrProvider implements OcrProvider {
  async read(_bytes: Buffer, _mimeType: string, docType: string): Promise<OcrResult> {
    return {
      fields: {
        doc_number: "12AB34567",
        country: "France",
        holder_name: "Camille Penhoat",
        issue_date: "2021-03-12",
        expiry_date: "2031-03-11",
        issue_place: "Paris",
      },
      raw: { mock: true, docType },
    };
  }
}
```

Run: `npm run test -- ocr/mock` → PASS.

- [ ] **Step 4: Provider Anthropic réel**

Create `src/lib/services/ocr/anthropic.ts` :

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { OcrProvider, OcrResult, OcrFields } from "./types";
import { EMPTY_FIELDS } from "./types";

const PROMPT =
  "Tu es un moteur d'extraction de pièces d'identité. À partir de l'image/PDF fourni, renvoie " +
  "UNIQUEMENT un objet JSON valide, sans texte autour, avec exactement ces clés : doc_number, " +
  "country, holder_name, issue_date, expiry_date, issue_place. Les dates au format ISO " +
  "YYYY-MM-DD. Mets null pour tout champ illisible ou absent. N'invente rien.";

function parseFields(text: string): OcrFields {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return { ...EMPTY_FIELDS };
    const o = JSON.parse(text.slice(start, end + 1)) as Partial<OcrFields>;
    const s = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
    return {
      doc_number: s(o.doc_number), country: s(o.country), holder_name: s(o.holder_name),
      issue_date: s(o.issue_date), expiry_date: s(o.expiry_date), issue_place: s(o.issue_place),
    };
  } catch {
    return { ...EMPTY_FIELDS };
  }
}

export class AnthropicOcrProvider implements OcrProvider {
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
  async read(bytes: Buffer, mimeType: string, _docType: string): Promise<OcrResult> {
    const b64 = bytes.toString("base64");
    const doc =
      mimeType === "application/pdf"
        ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: b64 } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType as "image/jpeg" | "image/png", data: b64 } };
    const resp = await this.client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: [doc, { type: "text", text: PROMPT }] }],
    });
    const text = resp.content.find((b) => b.type === "text");
    const fields = parseFields(text && "text" in text ? text.text : "");
    return { fields, raw: resp };
  }
}
```

(Si le type du content block PDF/image diverge dans la version installée du SDK, l'implémenteur consulte les types du package et adapte — la sémantique reste : image base64 ou document PDF base64 + prompt texte.)

- [ ] **Step 5: Sélecteur**

Create `src/lib/services/ocr/index.ts` :

```ts
import { env } from "@/lib/env";
import { MockOcrProvider } from "./mock";
import { AnthropicOcrProvider } from "./anthropic";
import type { OcrProvider } from "./types";

export function getOcrProvider(): OcrProvider {
  if (env.ANTHROPIC_API_KEY) return new AnthropicOcrProvider(env.ANTHROPIC_API_KEY);
  return new MockOcrProvider();
}

export type { OcrProvider, OcrResult, OcrFields } from "./types";
export { EMPTY_FIELDS } from "./types";
```

- [ ] **Step 6: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test -- ocr`
Expected: PASS.
```bash
git add package.json package-lock.json src/lib/services/ocr/
git commit -m "feat(famille): provider OCR Anthropic + mock (sélection par clé d'env)"
```

---

### Task 2: Route OCR `/api/famille/documents/read` + e2e

**Files:**
- Create: `src/app/api/famille/documents/read/route.ts`
- Test: `e2e/famille-ocr.spec.ts`

**Interfaces:**
- Consumes: `getOcrProvider` (Task 1).
- Produces: `POST /api/famille/documents/read` → 200 `{ fields, raw }` / 400 / 401 / 502.

- [ ] **Step 1: Route**

Create `src/app/api/famille/documents/read/route.ts` :

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOcrProvider } from "@/lib/services/ocr";

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non_authentifie" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const docType = form.get("docType");
  if (!(file instanceof File) || typeof docType !== "string") {
    return NextResponse.json({ error: "entree_invalide" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "type_non_supporte" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX) return NextResponse.json({ error: "taille_invalide" }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await getOcrProvider().read(buf, file.type, docType);
    return NextResponse.json(
      { fields: result.fields, raw: result.raw },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "lecture_indisponible" }, { status: 502 });
  }
}
```

- [ ] **Step 2: e2e route**

Create `e2e/famille-ocr.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: Page, email: string) {
  await page.goto("/fr/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/fr\/accueil/);
}

test("route OCR : 401 sans auth", async ({ request }) => {
  const resp = await request.post("/api/famille/documents/read", {
    multipart: { docType: "passeport", file: { name: "p.pdf", mimeType: "application/pdf", buffer: PDF } },
  });
  expect(resp.status()).toBe(401);
});

test("route OCR : 400 type non supporté", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.post("/api/famille/documents/read", {
    multipart: { docType: "passeport", file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("nope") } },
  });
  expect(resp.status()).toBe(400);
});

test("route OCR : 200 + champs (mock) sans rien persister", async ({ page }) => {
  await login(page, "client@vito.test");
  const resp = await page.request.post("/api/famille/documents/read", {
    multipart: { docType: "passeport", file: { name: "p.pdf", mimeType: "application/pdf", buffer: PDF } },
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.fields.country).toBe("France");
  expect(body.fields.expiry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
```

- [ ] **Step 3: Lancer e2e (reset) + typecheck + lint**

Run: `supabase db reset && npx playwright test famille-ocr --retries=0 && npm run typecheck && npm run lint`
Expected: 3 tests PASS (mock provider, clé absente). (Flake `liste_items`/anon → relancer une fois.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/famille/documents/read/route.ts e2e/famille-ocr.spec.ts
git commit -m "feat(famille): route OCR /api/famille/documents/read (auth + validation, ne persiste rien) + e2e"
```

---

### Task 3: `documentInputSchema` (TDD) + action `creerDocument`

**Files:**
- Modify: `src/features/famille/domain/schemas.ts`
- Test: `src/features/famille/domain/schemas.test.ts`
- Modify: `src/features/famille/data/actions.ts`

**Interfaces:**
- Consumes: `RELATIONS`/`CIRCLES` n/a ; `encryptDocument`/`getDocumentKey` ; `userId` (helper privé existant dans actions.ts) ; `redirect`/`getLocale` locale-aware (déjà importés en Slice 3).
- Produces: `documentInputSchema` + `DocTypeEnum` ; `creerDocument(_prev, formData)`.

- [ ] **Step 1: Schéma (test qui échoue)**

Append to `src/features/famille/domain/schemas.test.ts` :

```ts
import { documentInputSchema } from "./schemas";

describe("documentInputSchema", () => {
  const base = { doc_type: "passeport" };
  it("accepte un type seul (champs optionnels vides)", () => {
    expect(documentInputSchema.safeParse({ ...base, doc_number: "", country: "", holder_name: "", issue_date: "", expiry_date: "", issue_place: "" }).success).toBe(true);
  });
  it("accepte des champs renseignés", () => {
    expect(documentInputSchema.safeParse({ ...base, doc_number: "12AB34567", country: "France", issue_date: "2021-03-12", expiry_date: "2031-03-11" }).success).toBe(true);
  });
  it("rejette un doc_type inconnu", () => {
    expect(documentInputSchema.safeParse({ doc_type: "carte_vitale" }).success).toBe(false);
  });
});
```

Run: `npm run test -- schemas` → FAIL.

- [ ] **Step 2: Schéma**

Append to `src/features/famille/domain/schemas.ts` :

```ts
export const DOC_TYPES = ["passeport", "carte_identite", "permis_conduire", "permis_bateau", "visa", "titre_sejour", "autre"] as const;

export const documentInputSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  doc_number: z.string().max(120).optional().or(z.literal("")),
  country: z.string().max(120).optional().or(z.literal("")),
  holder_name: z.string().max(240).optional().or(z.literal("")),
  issue_date: z.string().optional().or(z.literal("")),
  expiry_date: z.string().optional().or(z.literal("")),
  issue_place: z.string().max(240).optional().or(z.literal("")),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;
```

Run: `npm run test -- schemas` → PASS.

- [ ] **Step 3: Action `creerDocument`**

Append to `src/features/famille/data/actions.ts`. Ajouter en tête les imports manquants :

```ts
import { encryptDocument } from "@/lib/crypto/documents";
import { getDocumentKey } from "@/lib/crypto/documentKey";
import { documentInputSchema } from "../domain/schemas";
```

(`redirect`, `getLocale`, et le helper `routing` locale-aware sont déjà importés/utilisés par les actions proches de Slice 3 — réutilise le même mécanisme de redirection que `creerProche`.)

```ts
const DOC_ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const DOC_MAX = 10 * 1024 * 1024;

export async function creerDocument(_prev: unknown, formData: FormData) {
  const memberId = formData.get("memberId");
  const file = formData.get("file");
  if (typeof memberId !== "string" || !memberId || !(file instanceof File)) return { error: "Entrée invalide" };
  if (!DOC_ALLOWED.includes(file.type)) return { error: "Type non supporté" };
  if (file.size <= 0 || file.size > DOC_MAX) return { error: "Fichier vide ou trop volumineux (max 10 Mo)" };

  const parsed = documentInputSchema.safeParse({
    doc_type: formData.get("docType"),
    doc_number: formData.get("doc_number") ?? "",
    country: formData.get("country") ?? "",
    holder_name: formData.get("holder_name") ?? "",
    issue_date: formData.get("issue_date") ?? "",
    expiry_date: formData.get("expiry_date") ?? "",
    issue_place: formData.get("issue_place") ?? "",
  });
  if (!parsed.success) return { error: "Champs invalides" };

  const supabase = await createServerSupabase();
  const uid = await userId(supabase);
  if (!uid) return { error: "Non authentifié" };

  let chiffre: string;
  try {
    chiffre = encryptDocument(Buffer.from(await file.arrayBuffer()), getDocumentKey()).toString("base64");
  } catch {
    return { error: "Chiffrement indisponible" };
  }

  const ocrRawStr = formData.get("ocrRaw");
  let ocr_raw: unknown = null;
  if (typeof ocrRawStr === "string" && ocrRawStr) { try { ocr_raw = JSON.parse(ocrRawStr); } catch { ocr_raw = null; } }

  const p = parsed.data;
  const { error } = await supabase.from("family_documents").insert({
    user_id: uid,
    member_id: memberId,
    doc_type: p.doc_type,
    doc_number: clean(formData.get("doc_number")),
    country: clean(formData.get("country")),
    holder_name: clean(formData.get("holder_name")),
    issue_date: clean(formData.get("issue_date")),
    expiry_date: clean(formData.get("expiry_date")),
    issue_place: clean(formData.get("issue_place")),
    contenu_chiffre: chiffre,
    mime_type: file.type,
    taille: file.size,
    ocr_raw,
  });
  if (error) return { error: "Enregistrement échoué" };
  revalidatePath(`/famille/proches/${memberId}`);
  redirect({ href: `/famille/proches/${memberId}`, locale: await getLocale() });
}
```

(Réutilise le helper `clean()` déjà ajouté en Slice 3. Si la signature exacte de `redirect` locale-aware diffère, calque EXACTEMENT ce que font `creerProche`/`modifierProche` dans le même fichier.)

- [ ] **Step 4: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test -- schemas`
Expected: PASS.
```bash
git add src/features/famille/domain/schemas.ts src/features/famille/domain/schemas.test.ts src/features/famille/data/actions.ts
git commit -m "feat(famille): documentInputSchema + action creerDocument (chiffre + insère au submit)"
```

---

### Task 4: i18n `famille.tunnel.*` + composants stepper

**Files:**
- Modify: `messages/{fr,en,it,es}.json`
- Create: `src/features/famille/ui/DocumentTunnel.tsx`
- Create: `src/features/famille/ui/AjouterDocumentButton.tsx`

**Interfaces:**
- Consumes: `creerDocument` (Task 3) ; `DOC_TYPES` (Task 3) ; `getOcrProvider` types via la route ; `DocTypeIcon` (Slice 2) ; `OcrFields`/`EMPTY_FIELDS` (Task 1) ; `Button` ; `Link` (`@/lib/i18n/routing`).
- Produces: `DocumentTunnel` (client), `AjouterDocumentButton` (client).

- [ ] **Step 1: i18n (4 locales, parité)**

Ajouter sous `famille` le sous-objet `tunnel` dans les 4 fichiers (valeurs FR ci-dessous ; traduire en/it/es ; mêmes clés partout). Ne pas toucher aux clés existantes.

`messages/fr.json` → `famille.tunnel` :
```json
"tunnel": {
  "ajouterDocument": "Ajouter un document",
  "titre": "Nouveau document",
  "stepOf": "{n} / 4",
  "aTitre": "Quel document ?", "aSous": "Choisissez le type de papier à enregistrer.", "continuer": "Continuer",
  "bTitre": "Ajoutez le document", "bDepose": "Déposez votre document", "bOu": "ou utilisez un des choix ci-dessous",
  "bPhoto": "Prendre une photo", "bImporter": "Importer un fichier", "bContraintes": "JPG, PNG ou PDF · 10 Mo max · chiffré",
  "bErreurTitre": "Échec de l'import", "bNonSupporte": "non supporté", "bReessayer": "Réessayer", "bAutreFichier": "Choisir un autre fichier",
  "cTitre": "Lecture du document…", "cSous": "Extraction des informations en cours.",
  "dTitre": "Vérifiez les informations", "dLuAuto": "Lu automatiquement", "dAVerifier": "À vérifier",
  "dNumero": "Numéro", "dPays": "Pays d'émission", "dTitulaire": "Titulaire", "dEmission": "Émission", "dExpiration": "Expiration", "dLieu": "Lieu d'émission",
  "dSaisieManuelle": "Lecture impossible — saisis les informations à la main.", "dEnregistrer": "Enregistrer le document"
}
```
`en` (My… → ) : ajouterDocument "Add a document", titre "New document", stepOf "{n} / 4", aTitre "Which document?", aSous "Choose the type of paper to save.", continuer "Continue", bTitre "Add the document", bDepose "Drop your document", bOu "or use one of the options below", bPhoto "Take a photo", bImporter "Import a file", bContraintes "JPG, PNG or PDF · 10 MB max · encrypted", bErreurTitre "Import failed", bNonSupporte "unsupported", bReessayer "Retry", bAutreFichier "Choose another file", cTitre "Reading the document…", cSous "Extracting the information.", dTitre "Check the information", dLuAuto "Auto-read", dAVerifier "To check", dNumero "Number", dPays "Issuing country", dTitulaire "Holder", dEmission "Issued", dExpiration "Expiry", dLieu "Place of issue", dSaisieManuelle "Couldn't read it — enter the details manually.", dEnregistrer "Save document".
`it` : ajouterDocument "Aggiungi un documento", titre "Nuovo documento", stepOf "{n} / 4", aTitre "Quale documento?", aSous "Scegli il tipo di documento da salvare.", continuer "Continua", bTitre "Aggiungi il documento", bDepose "Trascina il documento", bOu "oppure usa una delle opzioni qui sotto", bPhoto "Scatta una foto", bImporter "Importa un file", bContraintes "JPG, PNG o PDF · 10 MB max · cifrato", bErreurTitre "Import non riuscito", bNonSupporte "non supportato", bReessayer "Riprova", bAutreFichier "Scegli un altro file", cTitre "Lettura del documento…", cSous "Estrazione delle informazioni in corso.", dTitre "Verifica le informazioni", dLuAuto "Letto automaticamente", dAVerifier "Da verificare", dNumero "Numero", dPays "Paese di emissione", dTitulaire "Titolare", dEmission "Emissione", dExpiration "Scadenza", dLieu "Luogo di emissione", dSaisieManuelle "Lettura non riuscita — inserisci i dati manualmente.", dEnregistrer "Salva documento".
`es` : ajouterDocument "Añadir un documento", titre "Nuevo documento", stepOf "{n} / 4", aTitre "¿Qué documento?", aSous "Elige el tipo de documento a guardar.", continuer "Continuar", bTitre "Añade el documento", bDepose "Arrastra tu documento", bOu "o usa una de las opciones siguientes", bPhoto "Hacer una foto", bImporter "Importar un archivo", bContraintes "JPG, PNG o PDF · 10 MB máx · cifrado", bErreurTitre "Error de importación", bNonSupporte "no admitido", bReessayer "Reintentar", bAutreFichier "Elegir otro archivo", cTitre "Leyendo el documento…", cSous "Extrayendo la información.", dTitre "Verifica la información", dLuAuto "Leído automáticamente", dAVerifier "Por verificar", dNumero "Número", dPays "País de emisión", dTitulaire "Titular", dEmission "Emisión", dExpiration "Caducidad", dLieu "Lugar de emisión", dSaisieManuelle "No se pudo leer — introduce los datos manualmente.", dEnregistrer "Guardar documento".

Run: `npm run test -- messages-parity` → PASS.

- [ ] **Step 2: `AjouterDocumentButton`**

Create `src/features/famille/ui/AjouterDocumentButton.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";

export function AjouterDocumentButton({ memberId }: { memberId: string }) {
  const t = useTranslations("famille");
  return (
    <Link href={`/famille/proches/${memberId}/documents/nouveau`}>
      <Button variant="ghost" className="text-sm">{t("tunnel.ajouterDocument")}</Button>
    </Link>
  );
}
```

- [ ] **Step 3: `DocumentTunnel`**

Create `src/features/famille/ui/DocumentTunnel.tsx` :

```tsx
"use client";
import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useTranslations } from "next-intl";
import { creerDocument } from "../data/actions";
import { DOC_TYPES } from "../domain/schemas";
import { DocTypeIcon } from "./DocTypeIcon";
import { Button } from "@/features/shared/ui/Button";
import { EMPTY_FIELDS, type OcrFields } from "@/lib/services/ocr";

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX = 10 * 1024 * 1024;
const FIELD = "rounded-control border border-line bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-accent";

type Step = "A" | "B" | "C" | "D";

export function DocumentTunnel({ memberId }: { memberId: string }) {
  const t = useTranslations("famille");
  const [step, setStep] = useState<Step>("A");
  const [docType, setDocType] = useState<string>("passeport");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<OcrFields>(EMPTY_FIELDS);
  const [ocrRaw, setOcrRaw] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [uploadError, setUploadError] = useState<{ name: string; size: number } | null>(null);
  const [state, dispatch, pending] = useActionState(creerDocument, undefined);
  const stepN = { A: 1, B: 2, C: 3, D: 4 }[step];

  function pick(f: File) {
    if (!ALLOWED.includes(f.type) || f.size <= 0 || f.size > MAX) { setUploadError({ name: f.name, size: f.size }); return; }
    setUploadError(null); setFile(f); setStep("C");
  }

  // Étape C : lecture OCR (la route ne persiste rien). Échec → fallback manuel en D.
  useEffect(() => {
    if (step !== "C" || !file) return;
    let cancelled = false;
    (async () => {
      try {
        const fd = new FormData(); fd.set("file", file); fd.set("docType", docType);
        const resp = await fetch("/api/famille/documents/read", { method: "POST", body: fd });
        if (!resp.ok) throw new Error();
        const body = await resp.json();
        if (cancelled) return;
        setFields({ ...EMPTY_FIELDS, ...body.fields }); setOcrRaw(JSON.stringify(body.raw ?? null)); setManual(false);
      } catch {
        if (cancelled) return;
        setFields(EMPTY_FIELDS); setOcrRaw(null); setManual(true);
      } finally {
        if (!cancelled) setStep("D");
      }
    })();
    return () => { cancelled = true; };
  }, [step, file, docType]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData(e.currentTarget);
    fd.set("memberId", memberId); fd.set("docType", docType); fd.set("file", file);
    if (ocrRaw) fd.set("ocrRaw", ocrRaw);
    startTransition(() => dispatch(fd));
  }

  return (
    <div data-testid="document-tunnel" className="flex max-w-md flex-col gap-4">
      <div className="text-sm text-muted">{t("tunnel.titre")} · {t("tunnel.stepOf", { n: stepN })}</div>

      {step === "A" && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.aTitre")}</h2>
          <p className="text-muted">{t("tunnel.aSous")}</p>
          <ul className="grid grid-cols-2 gap-2">
            {DOC_TYPES.map((dt) => (
              <li key={dt}>
                <button type="button" onClick={() => setDocType(dt)}
                  className={`flex w-full items-center gap-2 rounded-card border p-3 text-left ${docType === dt ? "border-accent" : "border-line"}`}>
                  <DocTypeIcon docType={dt} /><span className="text-sm text-ink">{t(`docTypes.${dt}`)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button onClick={() => setStep("B")}>{t("tunnel.continuer")}</Button>
        </div>
      )}

      {step === "B" && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.bTitre")}</h2>
          {uploadError && (
            <div role="alert" className="rounded-card border border-danger bg-danger-bg p-3 text-sm text-danger">
              <div className="font-semibold">{t("tunnel.bErreurTitre")}</div>
              <div>{uploadError.name} · {(uploadError.size / 1048576).toFixed(1)} Mo · {t("tunnel.bNonSupporte")}</div>
            </div>
          )}
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-card border border-dashed border-line p-6 text-center">
            <span className="text-ink">{t("tunnel.bDepose")}</span>
            <span className="text-sm text-muted">{t("tunnel.bContraintes")}</span>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              data-testid="tunnel-file" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
            <span className="mt-2 inline-flex gap-2">
              <span className="rounded-control border border-line px-3 py-1.5 text-sm">{t("tunnel.bPhoto")}</span>
              <span className="rounded-control border border-line px-3 py-1.5 text-sm">{t("tunnel.bImporter")}</span>
            </span>
          </label>
        </div>
      )}

      {step === "C" && (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.cTitre")}</h2>
          <p className="text-muted">{t("tunnel.cSous")}</p>
        </div>
      )}

      {step === "D" && (
        <form onSubmit={submit} data-testid="tunnel-verify" className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl text-ink">{t("tunnel.dTitre")}</h2>
          {manual && <p role="status" className="text-sm text-muted">{t("tunnel.dSaisieManuelle")}</p>}
          <Field name="doc_number" label={t("tunnel.dNumero")} def={fields.doc_number} auto={!manual && !!fields.doc_number} t={t} />
          <Field name="country" label={t("tunnel.dPays")} def={fields.country} auto={!manual && !!fields.country} t={t} />
          <Field name="holder_name" label={t("tunnel.dTitulaire")} def={fields.holder_name} auto={!manual && !!fields.holder_name} t={t} />
          <Field name="issue_date" label={t("tunnel.dEmission")} def={fields.issue_date} auto={!manual && !!fields.issue_date} t={t} type="date" />
          <Field name="expiry_date" label={t("tunnel.dExpiration")} def={fields.expiry_date} auto={!manual && !!fields.expiry_date} t={t} type="date" />
          <Field name="issue_place" label={t("tunnel.dLieu")} def={fields.issue_place} auto={!manual && !!fields.issue_place} t={t} />
          {state && "error" in state && state.error && <p role="alert" className="text-danger">{state.error}</p>}
          <Button type="submit" pending={pending}>{t("tunnel.dEnregistrer")}</Button>
        </form>
      )}
    </div>
  );
}

function Field({ name, label, def, auto, type = "text", t }: {
  name: string; label: string; def: string | null; auto: boolean; type?: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-sm text-muted">
        {label}
        <span className="text-xs text-accent">{auto ? t("tunnel.dLuAuto") : t("tunnel.dAVerifier")}</span>
      </span>
      <input name={name} type={type} defaultValue={def ?? ""} className={FIELD} />
    </label>
  );
}
```

(Note Next 16 : `DocumentTunnel` est un client component ; le `File` est porté en state et ré-attaché au `FormData` du submit via `dispatch(fd)` — pas d'`<input type=file>` re-peuplé. Consulter `node_modules/next/dist/docs/` si un doute sur `useActionState`/form actions.)

- [ ] **Step 4: typecheck + lint + test + commit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (parité i18n verte).
```bash
git add messages/ src/features/famille/ui/DocumentTunnel.tsx src/features/famille/ui/AjouterDocumentButton.tsx
git commit -m "feat(famille): stepper DocumentTunnel A→D + AjouterDocumentButton + i18n tunnel 4 locales"
```

---

### Task 5: Page tunnel + CTA sur la fiche + e2e tunnel complet

**Files:**
- Create: `src/app/[locale]/(app)/famille/proches/[id]/documents/nouveau/page.tsx`
- Modify: `src/features/famille/ui/FichePersonne.tsx`
- Test: `e2e/famille.spec.ts` (ajouter un test ; ne pas toucher les existants)

**Interfaces:**
- Consumes: `getProche` (Slice 3), `DocumentTunnel`/`AjouterDocumentButton` (Task 4).

- [ ] **Step 1: Page tunnel**

Create `src/app/[locale]/(app)/famille/proches/[id]/documents/nouveau/page.tsx` :

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProche } from "@/features/famille/data/queries";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { DocumentTunnel } from "@/features/famille/ui/DocumentTunnel";

export default async function NouveauDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("famille");
  const data = await getProche(id);
  if (!data) notFound();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("tunnel.titre")} />
      <DocumentTunnel memberId={id} />
    </main>
  );
}
```

- [ ] **Step 2: CTA sur la fiche**

Dans `src/features/famille/ui/FichePersonne.tsx`, importer `AjouterDocumentButton` et le rendre dans l'en-tête de la section « Documents » (à côté du `SectionLabel`). Exemple de modification de la section documents :

```tsx
// import en tête :
import { AjouterDocumentButton } from "./AjouterDocumentButton";

// remplacer le <SectionLabel>{t("fiche.documents")}</SectionLabel> de la section documents par :
<div className="flex items-center justify-between">
  <SectionLabel>{t("fiche.documents")}</SectionLabel>
  <AjouterDocumentButton memberId={proche.id} />
</div>
```

(Le reste de la section — liste `DocumentRow` ou texte « Aucun document » — est inchangé. Le CTA remplace l'absence volontaire de Slice 3.)

- [ ] **Step 3: e2e tunnel complet**

Append to `e2e/famille.spec.ts` (nouveau `test`, réutilise le helper `login` du fichier) :

```ts
test("ajouter un document à un proche via le tunnel OCR (mock) et le voir sur la fiche", async ({ page }) => {
  const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  await login(page, "client@vito.test");
  // client a un proche seedé « Camille Durand » (Slice 3)
  await page.goto("/fr/famille");
  await page.getByTestId("proche-row").filter({ hasText: "Camille Durand" }).click();
  await expect(page).toHaveURL(/\/famille\/proches\//);

  await page.getByRole("link", { name: "Ajouter un document" }).click();
  await expect(page.getByTestId("document-tunnel")).toBeVisible();

  // A : Passeport est sélectionné par défaut → Continuer
  await page.getByRole("button", { name: "Continuer" }).click();
  // B : importer un PDF → déclenche C (OCR mock) puis D
  await page.getByTestId("tunnel-file").setInputFiles({ name: "passeport.pdf", mimeType: "application/pdf", buffer: PDF });
  // D : pré-rempli par le mock (pays France) → enregistrer
  await expect(page.getByTestId("tunnel-verify")).toBeVisible();
  await expect(page.locator('input[name="country"]')).toHaveValue("France");
  await page.getByRole("button", { name: "Enregistrer le document" }).click();

  // Retour fiche : le document apparaît, et la route déchiffrée renvoie 200
  await expect(page).toHaveURL(/\/famille\/proches\/[^/]+$/);
  const row = page.getByTestId("document-row").filter({ hasText: "Passeport" });
  await expect(row.first()).toBeVisible();
  const href = await row.first().getByRole("link", { name: "Voir le document" }).getAttribute("href");
  expect(href).toBeTruthy();
  const resp = await page.request.get(href!);
  expect(resp.status()).toBe(200);
});
```

- [ ] **Step 4: e2e ciblée (reset) + typecheck + lint**

Run: `supabase db reset && npx playwright test famille famille-ocr famille-documents --retries=0 && npm run typecheck && npm run lint`
Expected: tous PASS (existants + nouveaux). (Flake `liste_items`/anon → relancer une fois.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(app)/famille/proches/[id]/documents" src/features/famille/ui/FichePersonne.tsx e2e/famille.spec.ts
git commit -m "feat(famille): page tunnel + CTA Ajouter un document sur la fiche + e2e tunnel complet"
```

---

### Task 6: Non-régression complète + build

**Files:** aucun (vérification).

- [ ] **Step 1: Suite complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: e2e **verte** + build OK (idéalement sans warning). (Flake `liste_items`/anon → relancer le fichier concerné une fois.)

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(famille): correctifs non-régression Slice 4" # seulement si nécessaire
```

---

## Notes d'exécution

- **Aucune migration** (00019 déjà en prod). Nouvelle dépendance `@anthropic-ai/sdk` (lockfile commité).
- **Prérequis prod** : `ANTHROPIC_API_KEY` doit être dans l'env Vercel Production (sinon mock en prod). À confirmer au merge.
- **Sécurité** : OCR mocké en CI (clé absente). Le fichier en clair n'existe qu'en mémoire (route + action), jamais loggé, jamais persisté non chiffré. `redirect`/`Link` locale-aware.
- **Filet** : Slices 1-3 inchangées ; la fiche gagne seulement le CTA. Les e2e existants doivent rester verts.
