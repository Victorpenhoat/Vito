# Épic — Famille « proches + pièces d'identité » (fusion) — Décisions & roadmap

> Directive PO du 2026-06-26 (brief « onglet Famille »), réconciliée avec la réalité de Vito via
> audit Étape-0. Source de vérité des décisions.

## Décisions validées (PO)

1. **Construire la fonctionnalité** (épic spec→plan→subagents→PR→prod, slice par slice).
2. **Fusion avec l'existant** : on **garde** le foyer partagé actuel (`familles`/`famille_membres`/
   `famille_restos` : membres = vrais utilisateurs, restos partagés) **et** on ajoute un **répertoire
   privé de proches** (`family_members`, non-utilisateurs) **+ leurs pièces d'identité**
   (`family_documents`). L'onglet `/famille` fusionne les deux : le **répertoire de proches** (cœur du
   nouveau design : sections proche/élargie/amis + fiches + documents) **+** un bloc **« Foyer
   partagé »** réutilisant l'existant (membres invités + restos partagés).
3. **OCR autorisé** : lecture auto des documents via l'**API vision d'Anthropic** (clé `ANTHROPIC_API_KEY`
   déjà en env). Egress de pièces d'identité (y compris mineurs) assumé par le PO. Jamais d'auto-save :
   l'utilisateur valide à l'étape Vérification. Sortie brute conservée dans `ocr_raw` (audit).
4. **Stockage chiffré au repos (standard Vito)** : **PAS de bucket Storage / signed URLs**. Les octets
   sont chiffrés (AES-256-GCM via `encryptDocument`/`getDocumentKey`, clé `DOCUMENTS_ENCRYPTION_KEY`)
   et stockés dans une **colonne `contenu_chiffre`**, comme `voyage_documents`. Lecture via route
   serveur qui **déchiffre + streame** (RLS-scopée, `private, no-store`). → le brief (bucket +
   signed URLs + `storage_path`) est **remplacé** par ce pattern existant (plus strict, cohérent).

## Conventions Vito (vs brief)

- `user_id` référence **`public.profiles(id)`** (pas `auth.users` directement), comme les autres
  tables. RLS **owner-only** : `user_id = auth.uid()` (le répertoire est privé, non partagé — pas de
  helper `can_access` nécessaire). Trigger `updated_at`. Prochaine migration = **00019**. Types
  régénérés.
- Validation upload : `image/jpeg`, `image/png`, `application/pdf` ; **10 Mo** max.
- Suppression d'une personne → `family_documents` en `on delete cascade` (octets chiffrés EN COLONNE
  → le cascade SQL suffit, **aucun bucket à nettoyer** — avantage du stockage chiffré en base).
- Numéros de document **masqués par défaut** (`FR•••••892`), révélés au tap (jamais en clair par défaut).
- Logique d'expiration partagée : `expired` (passé) / `soon` (< 6 mois) / `valid` — seuil 6 mois.

## Style

Le Carnet (déjà en place : crème/nuit, serif Newsreader, tokens `--danger`/`--gold`/etc.,
`rounded-card`/`rounded-control`, kit `PageHeader`/`SectionLabel`/`Card`/`Badge`/`Avatar`). Les tokens
du brief (couleurs, polices) correspondent déjà aux tokens Le Carnet — aucun nouveau token à créer
(sauf `--warn` pour « expire bientôt » si absent : à vérifier en slice 2).

## Roadmap (slices, une PR chacune, spec→plan→subagent→PR→prod)

1. **Migration 00019** : `family_members` + `family_documents` (`contenu_chiffre`, pas de bucket) +
   RLS owner-only + trigger `updated_at` + index + types. (Migration prod appliquée avant merge.)
2. **Domaine + composants d'affichage** : util `expiryStatus` (TDD) + `maskDocNumber` (TDD) ; `Avatar`
   (couleur déterministe), `RelationChip`, `ExpiryBadge`, `DocTypeIcon`. Publiables au kit Claude Design.
3. **Liste + état vide + fiche personne** (lecture) **+ CRUD personne**, et **fusion du foyer partagé**
   (bloc réutilisant `MembresList`/`FamilleRestos` existants). Numéros masqués, lien « Voir le
   document » via route déchiffrée.
4. **Tunnel d'ajout de document** (stepper 4 étapes) : upload chiffré → route OCR Anthropic
   (`/api/famille/documents/read`) → étape Vérification pré-remplie → insertion.
5. **Desktop** : sidebar + grille + **modale** stepper horizontal + aperçu document.
6. **Passe finale** : skeletons, erreurs (réseau/upload/OCR→saisie manuelle), a11y, et
   **rafraîchissement du kit Claude Design** avec les nouveaux composants (DocumentCard, ExpiryBadge,
   Stepper, OcrReviewForm…).

## Sécurité (rappel non négociable)

- RLS owner-only sur les 2 nouvelles tables (select/insert/update/delete : `user_id = auth.uid()`).
- Octets de fichier **jamais en clair** au repos ni dans une réponse client ; déchiffrement
  serveur uniquement (route + OCR). `ANTHROPIC_API_KEY`/`DOCUMENTS_ENCRYPTION_KEY` serveur uniquement.
- Numéros masqués par défaut. Validation type/taille stricte.

## Hors périmètre / dette

- Alerte globale d'expiration (dashboard) : différée (l'util `expiryStatus` la prépare).
- Partage des fiches de proches entre membres du foyer : hors scope (répertoire = privé owner-only).
