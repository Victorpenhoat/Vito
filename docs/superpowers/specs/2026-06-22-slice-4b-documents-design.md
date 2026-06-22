# Slice 4b — Documents chiffrés (voyages) — Design

**Date :** 2026-06-22
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `slice-4b-documents`

---

## 0. Contexte

Slice différé du Chantier 4 : attacher des **documents chiffrés** à un voyage (billets, réservations,
pièces). Acté en C4 : **AES-256-GCM applicatif, clé hors DB** (env Vercel, server-only). Réutilise le
modèle voyages (C4 : `can_access_voyage`, owner/membres). Débloque aussi le **dépôt de documents par
l'agence** (7b : l'agence est membre du voyage du client). Architecture : `features/voyages` (extension)
+ `lib/crypto`, RLS + grants, TDD (crypto pur), e2e.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Stockage du ciphertext | **base64 dans une colonne `text`** (`contenu_chiffre`) — fiable via supabase-js/PostgREST (évite l'encodage `bytea`) ; c'est du ciphertext AES-GCM au repos. |
| Chiffrement | **AES-256-GCM applicatif, clé hors DB** (`DOCUMENTS_ENCRYPTION_KEY` en env, server-only). |
| Accès | **Collaboratif** : tous les membres du voyage (owner + membres, incl. agence via 7b) déposent / téléchargent / suppriment (`can_access_voyage`). |
| Limites | **≤ 5 Mo / document** ; types : PDF, JPEG, PNG, WebP. |

## 2. Chiffrement (`src/lib/crypto/documents.ts`) + env

```ts
// AES-256-GCM. Format du blob : iv(12 octets) || authTag(16 octets) || ciphertext.
export function encryptDocument(plain: Buffer, key: Buffer): Buffer; // throws si key invalide
export function decryptDocument(blob: Buffer, key: Buffer): Buffer;   // throws si tag altéré
export function getDocumentKey(): Buffer; // décode env DOCUMENTS_ENCRYPTION_KEY (64 hex -> 32 octets)
```
- Fonctions `encrypt`/`decrypt` **pures** (clé en paramètre → testables sans env).
- `env.ts` : ajouter `DOCUMENTS_ENCRYPTION_KEY: z.string().optional()` (server-only). `getDocumentKey`
  valide la présence + le format (64 hex) et `throw` sinon (l'action mappe vers une erreur claire).
- **Clé jamais en DB, jamais côté client.**

## 3. Modèle de données (`supabase/migrations/00016_voyage_documents.sql`)

```sql
create table public.voyage_documents (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
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

## 4. Données / actions / route

- **Upload** : server action `ajouterDocument(_prev, formData)` — `voyageId` + un `File` (FormData) ;
  valide `mime_type` (liste) + `taille ≤ 5 Mo` ; `Buffer.from(await file.arrayBuffer())` →
  `encryptDocument(buf, getDocumentKey())` → `.toString("base64")` → insert
  `{ voyage_id, nom: file.name, mime_type, taille, contenu_chiffre, uploaded_by: session }`.
- **Delete** : `supprimerDocument(_prev, formData)` (`id`, `voyageId`) — `.delete().eq("id").select("id").maybeSingle()`.
- **queries** : `getVoyageDocuments(voyageId)` → `id, nom, mime_type, taille, created_at` (**jamais**
  `contenu_chiffre`).
- **Download** : **Route Handler** `src/app/api/voyages/documents/[id]/route.ts` (`GET`) —
  client Supabase de la session (RLS `can_access_voyage` ⇒ ligne visible seulement si membre, sinon
  **404**) ; lit `contenu_chiffre`+`mime_type`+`nom` ; `Buffer.from(b64, "base64")` →
  `decryptDocument(.., getDocumentKey())` → `new Response(bytes, { headers: { "Content-Type": mime,
  "Content-Disposition": attachment; filename="nom" } })`. 404 si introuvable/inaccessible ; 500 si
  déchiffrement échoue.

## 5. UI (intégration fiche voyage)

- `features/voyages/ui/VoyageDetail.tsx` : nouvelle section **Documents** (avant la fermeture
  `</article>`) — `DocumentsList` (par doc : nom, taille lisible, lien `download` vers
  `/api/voyages/documents/{id}`, bouton supprimer) + `DocumentUploadForm` (input `type=file`
  `accept=".pdf,image/*"`).
- Composants `features/voyages/ui/` : `DocumentsList`, `DocumentUploadForm`. `data-testid` :
  `documents-section`, `document-row`, `document-upload-form`.
- `getVoyageDetail` enrichi (ou un fetch séparé `getVoyageDocuments(id)` dans `VoyageDetail`).

## 6. i18n

Sous-clés `documents.*` dans le namespace `voyages` de `messages/fr.json` (titre « Documents »,
déposer, télécharger, supprimer, taille, vide, erreurs : type non supporté / trop volumineux / dépôt
échoué). Aucune chaîne en dur.

## 7. Sécurité

- **Chiffrement applicatif AES-256-GCM, clé hors DB** : l'opérateur DB/Storage ne voit que du
  ciphertext (base64). La clé `DOCUMENTS_ENCRYPTION_KEY` vit en env server-only.
- **Accès membres** : la route de download et la RLS s'appuient sur `can_access_voyage` ; un non-membre
  obtient **404** (aucune fuite de métadonnée ni d'octet). `contenu_chiffre` n'est jamais renvoyé par
  les queries de liste (seulement déchiffré à la volée par la route, pour un membre).
- **Intégrité** : le tag GCM est vérifié au déchiffrement (altération → échec). Validation taille/type
  à l'upload. `uploaded_by` de la session.

## 8. Tests & seed

- **Unit (Vitest, TDD)** : `encryptDocument`/`decryptDocument` — round-trip (decrypt(encrypt(x))===x) ;
  ciphertext ≠ clair ; blob altéré (flip d'un octet du tag/ciphertext) → `decrypt` throw ; clé de
  mauvaise longueur → throw.
- **Seed dev** : **aucun document pré-créé** (un blob pré-chiffré dépendrait d'une clé fixe = fragile).
  L'e2e crée son propre document via l'action (chiffré avec la clé runtime) puis le télécharge — donc
  cohérent quelle que soit la clé. Le voyage seed « Week-end à Rome »
  (`11111111-2222-4333-8444-555555555555`, partagé client↔agence) sert de support.
- **Variable d'env `DOCUMENTS_ENCRYPTION_KEY`** (64 hex) requise à l'exécution (upload/download) : le
  plan l'ajoute en **dev** (`.env`), en **CI** (env du job avant Playwright) et en **prod** (Vercel,
  à la clôture). Absente → `getDocumentKey` throw, l'action renvoie une erreur claire.
- **e2e (Playwright)** : sur le voyage seed — (1) un membre dépose un petit PDF → il apparaît dans
  `documents-section` (`document-row`) ; (2) le lien de téléchargement renvoie 200 + `Content-Type:
  application/pdf` ; (3) suppression → la ligne disparaît ; (4) un **non-membre** appelant
  `/api/voyages/documents/{id}` → **404**. Signaux déterministes.

## 9. Arbitrages / dette signalés

- Antivirus / scan de contenu ; aperçu inline (visionneuse) ; rotation de clé / chiffrement par
  enveloppe per-document ; versionnage ; gros fichiers (> 5 Mo → Supabase Storage) ; documents hors
  voyages (profil, famille) → différés.
