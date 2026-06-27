# Slice 4 (épic Famille) — Tunnel d'ajout de document + OCR Anthropic — Design

**Date :** 2026-06-27
**Statut :** Validé (PO). Plan ensuite.
**Branche :** `famille-tunnel-ocr`
**Directive :** `docs/design/famille-documents-epic-directive.md` (roadmap §4)
**Maquette :** `Onglet Famille.dc.html` (Claude Design), écrans « Ajout étape A/B/C/D » + « Erreur upload ».

---

## 0. Contexte

Slice 4 = le **tunnel d'ajout d'un document d'identité** à un proche, en 4 étapes, avec **lecture
automatique (OCR) via l'API vision d'Anthropic**. La Slice 3 a livré le répertoire + la fiche
(documents en lecture seule) ; ici on **crée** les documents. Le CTA « Ajouter un document » —
volontairement absent en Slice 3 — est ajouté sur la fiche et lance le tunnel.

**Décisions PO (2026-06-27) :** modèle OCR = **`claude-sonnet-4-6`** ; **fallback manuel basique** en
Slice 4 (échec OCR → étape D avec formulaire vide + message « saisie manuelle »), états d'erreur
riches reportés en Slice 6.

**Acquis réutilisés :** `family_documents` (migration 00019 : `contenu_chiffre`, `ocr_raw jsonb`,
RLS owner-only) ; `encryptDocument`/`getDocumentKey` ; pattern upload chiffré de
`voyages/data/documents.ts` ; `DocTypeIcon` (Slice 2) ; `getProche` (Slice 3) ; pattern
provider+mock de `src/lib/services/places/`.

## 1. Principe directeur — « jamais d'auto-save »

Le document n'est **persisté qu'au submit de l'étape D** (après validation humaine). Le fichier est
porté **côté client** de l'étape B à D (objet `File` en mémoire du composant tunnel) :
- étape C : le fichier est envoyé à la route OCR qui **lit et renvoie les champs — sans rien stocker** ;
- étape D : au submit, le fichier **+** les champs validés sont envoyés à l'action `creerDocument` qui
  **chiffre + insère**. Le fichier transite donc deux fois (OCR puis insert) — accepté (≤ 10 Mo, pas
  de ligne brouillon, conforme à la directive).

## 2. Provider OCR (`src/lib/services/ocr/`)

Pattern identique à `places/` (sélection par clé d'env → mock sinon).
- **`types.ts`** :
  ```
  type OcrFields = {
    doc_number: string | null; country: string | null; holder_name: string | null;
    issue_date: string | null;   // ISO YYYY-MM-DD ou null
    expiry_date: string | null;   // ISO YYYY-MM-DD ou null
    issue_place: string | null;
  };
  type OcrResult = { fields: OcrFields; raw: unknown };
  interface OcrProvider { read(bytes: Buffer, mimeType: string, docType: string): Promise<OcrResult>; }
  ```
- **`index.ts`** : `getOcrProvider(): OcrProvider` → `AnthropicOcrProvider(env.ANTHROPIC_API_KEY)` si la
  clé est présente, sinon `MockOcrProvider`. (CI/e2e : clé absente → **mock**, l'API n'est jamais
  appelée — contrainte respectée.)
- **`anthropic.ts`** : utilise le SDK officiel **`@anthropic-ai/sdk`** (nouvelle dépendance). Envoie le
  document comme content block image (jpeg/png → `type:"image"`, base64) ou PDF (`type:"document"`,
  base64), modèle `claude-sonnet-4-6`, avec une consigne d'extraction stricte demandant un **JSON**
  correspondant à `OcrFields` (dates normalisées ISO, `null` si illisible). Parse défensif : si le
  modèle renvoie autre chose qu'un JSON exploitable → `fields` tout `null` + `raw` conservé (→
  fallback manuel). Aucune exception propagée pour un contenu non lu (seules les vraies erreurs
  réseau/HTTP throwent).
- **`mock.ts`** : déterministe — renvoie des champs plausibles dérivés du `docType`
  (ex. passeport → `{doc_number:"12AB34567", country:"France", holder_name:"Camille Penhoat",
  issue_date:"2021-03-12", expiry_date:"2031-03-11", issue_place:"Paris"}`), `raw:{mock:true}`. Test
  unitaire de `MockOcrProvider`.

## 3. Route OCR (`src/app/api/famille/documents/read/route.ts`)

`POST` multipart (`file`, `docType`). Authentifiée (`auth.getUser()` → 401 sinon). Validation **mime
∈ {image/jpeg,image/png,application/pdf}** + **taille ≤ 10 Mo** (400 sinon, message FR). Appelle
`getOcrProvider().read(buf, mime, docType)` → renvoie `{ fields, raw }` en JSON (200). Erreur provider
réseau → 502 `{ error: "lecture_indisponible" }`. **Ne persiste rien, ne logge pas le contenu.**
`ANTHROPIC_API_KEY` server-only. `Cache-Control: private, no-store`.

## 4. Action `creerDocument` (`src/features/famille/data/actions.ts`, ajout)

`creerDocument(_prev, formData)` — `"use server"`. Entrées : `memberId`, `docType`, `file` (File),
`fields` (sérialisés : doc_number/country/holder_name/issue_date/expiry_date/issue_place), `ocrRaw`
(JSON string optionnel). Étapes :
1. Validation : `memberId` non vide ; `docType ∈` enum ; `file instanceof File` ; mime ∈ allowed ;
   `0 < size ≤ 10 Mo`. Champs texte parsés via un zod `documentInputSchema` (tous optionnels, dates
   ISO ou « »→null).
2. Auth (`userId`). RLS garantit que `memberId` appartient à l'utilisateur (insert avec
   `user_id = auth.uid()` ; FK `member_id` ; un member d'autrui → l'insert n'est pas autorisé car
   `user_id` posé = soi, et la fiche n'est atteignable que par l'owner — la RLS `with check
   (user_id = auth.uid())` protège).
3. `chiffre = encryptDocument(Buffer.from(await file.arrayBuffer()), getDocumentKey()).toString("base64")`.
4. `insert family_documents { user_id, member_id, doc_type, doc_number, country, holder_name,
   issue_date, expiry_date, issue_place, contenu_chiffre, mime_type, taille, ocr_raw }`.
5. `revalidatePath('/famille/proches/[id]')` (locale-aware) + `redirect` vers la fiche (via
   `@/lib/i18n/routing`, comme Slice 3).
Retour `{ error }` en cas d'échec (rendu par l'étape D).

## 5. UI — stepper (`src/features/famille/ui/`)

- **`AjouterDocumentButton`** (client) : ajouté sur `FichePersonne` (section Documents) → `Link`
  locale-aware vers `/famille/proches/[id]/documents/nouveau`.
- **`DocumentTunnel`** (client, `"use client"`) : machine à états `A→B→C→D` + barre « n / 4 ». Porte
  `docType`, `file`, `fields`, `ocrRaw` en `useState`.
  - **A** `StepType` : grille des 7 types (`DocTypeIcon` + libellé `t("docTypes.*")`), « Continuer ».
  - **B** `StepUpload` : « Prendre une photo » (`<input capture>`) / « Importer un fichier »
    (`accept=".jpg,.jpeg,.png,.pdf"`), libellé « JPG, PNG ou PDF · 10 Mo max · chiffré ». Validation
    client (mime+taille) → **état erreur** inline (« Échec de l'import · {nom} · {taille} · non
    supporté » + « Réessayer » / « Choisir un autre fichier »). Fichier valide → passe en C.
  - **C** `StepReading` : déclenche `fetch('/api/famille/documents/read', {method:'POST', body:FormData})`.
    Affiche « Lecture du document… ». Succès → stocke `fields`+`raw`, passe en D. Échec (réseau/502)
    → passe en D avec `fields` vides + drapeau `manual` (message « saisie manuelle »).
  - **D** `StepVerify` : `<form action={creerDocument}>` (`useActionState`) pré-rempli depuis `fields`
    (badges « Lu automatiquement » sur les champs renseignés par l'OCR ; « À vérifier » si vide).
    Champs : type (lecture seule, issu de A), numéro, pays, titulaire, émission (date), expiration
    (date), lieu d'émission. Hidden : `memberId`, `docType`, `file` (ré-attaché via un `input
    type=file` caché re-peuplé par un `DataTransfer`, OU le composant ré-upload le `File` détenu —
    voir note d'implémentation), `ocrRaw`. Bouton « Vérifier » / enregistrer.
- **Page** `src/app/[locale]/(app)/famille/proches/[id]/documents/nouveau/page.tsx` (Server
  Component) : `getProche(id)` → `notFound()` si null ; rend `DocumentTunnel memberId={id}`.

**Note d'implémentation (ré-attache du fichier à D) :** comme l'étape D est un `<form action>`, le
`File` détenu en state doit être renvoyé. Approche : le `DocumentTunnel` construit le `FormData` du
submit programmatiquement (append `file` + champs) et appelle l'action via `useActionState` déclenché
par un bouton, plutôt qu'un `<input type=file>` re-peuplé. L'implémenteur choisit la voie la plus
simple compatible Next 16 (RSC/actions) — **consulter `node_modules/next/dist/docs/` au besoin**.

## 6. i18n (`famille.tunnel.*`, 4 locales — parité)

Nouvelles clés sous `famille.tunnel` : `titre` (« Nouveau document »), `stepOf` (« {n} / 4 »),
`a` { titre:« Quel document ? », sous:« Choisissez le type… », continuer }, `b` { titre:« Ajoutez le
document », depose, ou, photo:« Prendre une photo », importer:« Importer un fichier », contraintes:
« JPG, PNG ou PDF · 10 Mo max · chiffré », erreurTitre:« Échec de l'import », nonSupporte:« non
supporté », reessayer, autreFichier }, `c` { titre:« Lecture du document… », sous }, `d` { titre:
« Vérifiez les informations », luAuto:« Lu automatiquement », aVerifier:« À vérifier », champNumero,
champPays, champTitulaire, champEmission, champExpiration, champLieu, saisieManuelle, enregistrer }.
Réutilise `docTypes.*`. Aucune chaîne en dur.

## 7. Sécurité (non négociable)

- `ANTHROPIC_API_KEY` / `DOCUMENTS_ENCRYPTION_KEY` **server-only**. La route OCR et l'action sont les
  seuls points de contact avec le fichier en clair ; le contenu **n'est jamais loggé**.
- Egress de pièces d'identité (y compris mineurs) vers Anthropic : **autorisé par le PO** (directive).
- Validation mime+taille **côté client (B) ET serveur (route + action)** — la validation serveur fait foi.
- `contenu_chiffre` chiffré au repos, jamais renvoyé au client (route Slice 3 = seul accès, déchiffré).
- RLS owner-only : insert avec `user_id = auth.uid()` ; impossible d'attacher un document à un proche
  d'autrui.

## 8. Tests

- **Unit** : `documentInputSchema` (dates ISO/vides→null, docType invalide) ; `MockOcrProvider.read`
  (déterministe par docType) ; parité i18n.
- **Route OCR** (e2e) : non authentifié → 401 ; mime/taille invalides → 400 ; fichier valide (mock
  provider, clé absente) → 200 + `fields` non vides + **aucune persistance** (la fiche reste sans
  nouveau doc tant que D n'est pas soumis).
- **e2e tunnel complet** : depuis la fiche d'un proche (seed/CRUD), CTA → A choisir Passeport → B
  importer un PDF minimal → C (OCR mock) → D pré-rempli → enregistrer → **le document apparaît sur la
  fiche** (numéro masqué + « Voir le document » → route Slice 3 renvoie 200). Test fallback : si la
  route OCR renvoie une erreur simulée, D s'ouvre en saisie manuelle (champ vide) et l'enregistrement
  fonctionne. **API Anthropic jamais appelée** (mock). RLS jamais testée contre la prod.
- typecheck/lint/test verts, e2e suite verte, build OK.

## 9. Prod

- **Aucune migration** (00019 déjà en prod : `contenu_chiffre`/`ocr_raw` existent).
- **Prérequis prod** : `ANTHROPIC_API_KEY` doit être présente dans l'env Vercel Production (déjà
  provisionnée selon la directive). Sans elle, le provider mock serait utilisé en prod — à vérifier
  avant/au merge. Nouvelle dépendance `@anthropic-ai/sdk` (lockfile commité).

## 10. Arbitrages / dette

- États d'erreur riches (skeleton de lecture animé, retry réseau détaillé, messages OCR fins) →
  **Slice 6**. Ici : fallback manuel basique suffit.
- Pas de compression/redimensionnement d'image avant OCR (YAGNI ; 10 Mo plafond). À reconsidérer si
  coûts/latence posent problème (dette notée).
- Desktop (modale stepper horizontal) = **Slice 5**.
