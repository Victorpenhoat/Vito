# Slice 3 (épic Famille) — Liste + fiche + CRUD proche + fusion foyer — Design

**Date :** 2026-06-27
**Statut :** Validé (PO). Plan ensuite.
**Branche :** `famille-proches`
**Directive :** `docs/design/famille-documents-epic-directive.md` (roadmap §3)

---

## 0. Contexte

Premier écran réel de l'épic Famille. Pose le **répertoire de proches** : liste groupée par cercle,
état vide, fiche personne en lecture (documents masqués + « Voir le document » via route déchiffrée),
et CRUD d'un proche. Fusionne l'onglet `/famille` : répertoire en héros + bloc « Foyer partagé »
réutilisant l'existant (`MembresList`/`InviteForm`/`FamilleRestos`). **Le tunnel d'upload/OCR est
Slice 4** — ici les documents sont en lecture seule (créés par seed/fixtures pour les tests).

Acquis réutilisés :
- Tables `family_members` + `family_documents` (migration 00019, RLS owner-only, `contenu_chiffre`).
- Domaine Slice 2 : `expiryStatus`/`monthsUntil` (`domain/expiry.ts`), `maskDocNumber`
  (`domain/mask.ts`), `avatarColor` (`domain/avatarColor.ts`).
- Composants Slice 2 : `Avatar` (tailles sm/md/lg/xl + `color`), `RelationChip`, `ExpiryBadge`,
  `DocTypeIcon`.
- Pattern route déchiffrée : `src/app/api/voyages/documents/[id]/route.ts` (à calquer).
- Helpers crypto : `decryptDocument` (`@/lib/crypto/documents`), `getDocumentKey`
  (`@/lib/crypto/documentKey`).
- Kit Le Carnet : `PageHeader`, `SectionLabel`, `Card`, `Button`, `Badge`.

## 1. Routes

| Route | Rôle |
|---|---|
| `/famille` | Répertoire héros (proches groupés par cercle) + bloc « Foyer partagé » replié dessous. |
| `/famille/proches/nouveau` | Formulaire création d'un proche. |
| `/famille/proches/[id]` | Fiche personne (lecture) : entête + liste documents. |
| `/famille/proches/[id]/modifier` | Formulaire édition + suppression. |
| `/api/famille/documents/[id]` | GET : déchiffre + streame l'octet (RLS owner-only, `private, no-store`). |

## 2. Couche data (`src/features/famille/data/`)

**`queries.ts` (ajouts)**
- `getProches()` : `family_members` de l'utilisateur (RLS owner-only) + pour chaque proche le
  **compteur de documents** et l'**expiration la plus urgente** (statut min via `expiryStatus` sur les
  `expiry_date` de ses documents). Retour trié par `last_name, first_name`. Le regroupement par
  `circle` se fait côté composant.
  - Type retour : `Proche[]` où
    `Proche = { id, first_name, last_name, relation, circle, avatar_color, phone, email, birth_date, doc_count: number, urgency: "expired" | "soon" | "valid" | null }`.
- `getProche(id)` : le `family_member` (RLS) **ou `null`** si introuvable + ses `family_documents`
  **SANS `contenu_chiffre`** (métadonnées seules).
  - Type retour : `{ proche: ProcheDetail; documents: DocMeta[] } | null` où
    `DocMeta = { id, doc_type, doc_number, country, holder_name, issue_date, expiry_date, mime_type }`.

**`actions.ts` (ajouts, `"use server"`)** — toutes : valident via zod, vérifient l'auth, s'appuient
sur la RLS owner-only, `revalidatePath`. Forme de retour `{ ok: true } | { error: string }` (comme
l'existant).
- `creerProche(_prev, formData)` : parse `procheInputSchema` ; `avatar_color = avatarColor(\`${first_name} ${last_name}\`)` ;
  insert `family_members` (`user_id = auth.uid()`) ; sur succès → **redirect** vers `/famille/proches/[id]`.
- `modifierProche(_prev, formData)` : parse (avec `id`) ; update la ligne (RLS) ; redirect vers la fiche.
- `supprimerProche(_prev, formData)` : delete la ligne (RLS ; cascade SQL supprime ses documents) ;
  redirect vers `/famille`.

(Le `redirect` Next se fait dans l'action après succès ; en cas d'erreur, retour `{ error }` rendu
par le formulaire.)

## 3. Domaine (`src/features/famille/domain/schemas.ts`, ajout)

```
procheInputSchema = z.object({
  first_name: z.string().min(1).max(120),
  last_name:  z.string().min(1).max(120),
  relation:   z.enum(["conjoint","enfant","parent","beau_parent","ami","autre"]),
  circle:     z.enum(["proche","elargie","amis"]),
  phone:      z.string().max(40).optional().or(z.literal("")),
  email:      z.string().email().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),   // ISO "YYYY-MM-DD" ou ""
})
```
- `""` normalisé en `null` avant insert (champs optionnels). TDD (valide / relation invalide /
  circle invalide / email invalide / champs optionnels vides).

## 4. UI (`src/features/famille/ui/`)

- **`ProchesList`** (server-friendly, présentational) : reçoit `Proche[]`, rend **3 sections par
  cercle** dans l'ordre Proches / Élargie / Amis (cercle vide → section masquée). Chaque proche =
  `<Link href="/famille/proches/[id]">` sur une `Card` : `Avatar size="lg" color={avatar_color}` +
  nom (serif) + `RelationChip` + ligne méta (`doc_count` documents) + `ExpiryBadge` si `urgency` ∈
  {expired, soon}.
- **`ProchesEmptyState`** : illustration sobre + texte + CTA `Button` → `/famille/proches/nouveau`.
- **`ProcheForm`** (client, `useActionState`) : partagé création/édition. Props
  `{ mode: "create" | "edit"; initial?: ProcheDetail }`. Champs : prénom, nom, select relation, select
  cercle, téléphone, e-mail, date de naissance. Affiche `error`. Bouton submit + (mode edit) un
  `<form>` séparé « Supprimer » appelant `supprimerProche` avec confirm.
- **`FichePersonne`** (présentational) : entête `Avatar size="xl" color` + nom serif + `RelationChip`
  + libellé cercle + contacts (phone/email/birth_date formatés). Section « Documents » : pour chaque
  doc, `DocumentRow` ; si liste vide → texte « Aucun document » (PAS de CTA d'ajout — Slice 4).
  Lien « Modifier » → `/famille/proches/[id]/modifier`.
- **`DocumentRow`** (client) : `DocTypeIcon` + libellé type (`t("docTypes.…")`) + **numéro masqué**
  (`maskDocNumber(doc_number)`, **révélé au tap** via état local) + `ExpiryBadge` (calcul
  `expiryStatus`/`monthsUntil` sur `expiry_date`) + lien « Voir le document » →
  `/api/famille/documents/[id]` (`target="_blank"`).

**Pages**
- `/famille/page.tsx` : si pas de proches **et** pas de foyer → `ProchesEmptyState`. Sinon : `PageHeader`
  + `ProchesList` (héros) + section repliée « Foyer partagé » réutilisant `MembresList`/`InviteForm`/
  `FamilleRestos` (logique `getMaFamille`/`getFamilleRestos` inchangée).
- `/famille/proches/nouveau/page.tsx` : `ProcheForm mode="create"`.
- `/famille/proches/[id]/page.tsx` : `getProche(id)` → `notFound()` si null, sinon `FichePersonne`.
- `/famille/proches/[id]/modifier/page.tsx` : `getProche(id)` → `notFound()` si null, sinon
  `ProcheForm mode="edit" initial`.

## 5. Route document (`src/app/api/famille/documents/[id]/route.ts`)

Calque exact de la route voyages : `select("doc_type, mime_type, contenu_chiffre")` filtré sur `id`
(RLS owner-only → non-owner obtient 0 ligne → 404, aucune fuite) ; `decryptDocument` + `getDocumentKey` ;
réponse binaire `Content-Type: mime_type`, `Content-Disposition: inline`, `Cache-Control: private, no-store`.
Échec déchiffrement → 500.

## 6. i18n (`famille.*`, 4 locales — parité garantie)

Nouvelles clés sous `famille` :
- `famille.proches` = `{ titre, ajouter, vide, videTexte, documentsCount }` (`documentsCount` ICU `{n}`).
- `famille.circles` = `{ proche, elargie, amis }` (Proches / Famille élargie / Amis + EN/IT/ES).
- `famille.fiche` = `{ contacts, naissance, documents, aucunDocument, voirDocument, modifier, revelerNumero }`.
- `famille.form` = `{ prenom, nom, relation, cercle, telephone, email, naissance, enregistrer, supprimer, confirmSuppr }`.
- (Réutilise `relations`/`docTypes`/`expiry` de Slice 2.) Aucune chaîne en dur.

## 7. Sécurité (non négociable)

- RLS owner-only sur `family_members`/`family_documents` (déjà en place 00019). Toutes les queries
  passent par le client serveur RLS-scopé.
- `contenu_chiffre` **jamais** sélectionné par `getProche` ni renvoyé au client ; déchiffrement
  **serveur uniquement** dans la route. `DOCUMENTS_ENCRYPTION_KEY` serveur only.
- Numéros de document **masqués par défaut**, révélés au tap (jamais en clair au rendu initial).

## 8. Tests

- **Unit** : `procheInputSchema` (valide / relation & circle invalides / email invalide / optionnels
  vides → null). typecheck + lint + test verts ; parité i18n verte.
- **RLS** (SQL, local uniquement — jamais prod) : un user B ne `select`/`update`/`delete` aucune ligne
  `family_members`/`family_documents` d'un user A ; insert avec `user_id` ≠ `auth.uid()` rejeté.
- **e2e** : créer un proche (formulaire) → apparaît dans la bonne section de cercle ; ouvrir la fiche ;
  modifier (changement visible) ; supprimer (disparaît) ; `GET /api/famille/documents/[id]` renvoie
  l'octet pour l'owner (doc seedé) et **404** pour un non-owner. (Flake connu `liste_items`/anon →
  relancer une fois.) Build OK. Aucune API externe ici.

## 9. Arbitrages / dette

- CTA « Ajouter un document » volontairement **absent** de la fiche en Slice 3 (pas de bouton mort) →
  arrive avec le tunnel Slice 4.
- Pas d'alerte d'expiration agrégée (différée, cf. directive) ; `ExpiryBadge` la prépare au niveau carte.
- Desktop (sidebar/grille/modale) = Slice 5. Ici, layout mobile-first responsive simple.

## 10. Prod

- Aucune migration nouvelle (00019 déjà appliquée). Merge standard après CI verte.
