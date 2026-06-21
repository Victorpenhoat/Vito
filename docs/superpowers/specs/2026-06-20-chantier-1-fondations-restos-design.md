# Chantier 1 — Fondations + Module Restos — Design

**Date :** 2026-06-20
**Statut :** Validé (plan d'architecture). Implémentation à découper dans un plan dédié.
**Auteur :** Lead engineer (Claude) — validé par Victor.

---

## 0. Contexte & exigence

Application web + mobile (**PWA d'abord**, natif plus tard) : carnet personnel intelligent de
sorties et de voyages. Chaque réservation et chaque avis enrichit le profil de goût de
l'utilisateur, ce qui affine les recommandations.

Niveau d'exigence : **production-grade**, milliers d'utilisateurs réels, **zéro dette technique**.
Méthode **diagnostic-first** : plan validé → implémentation → tests → revue, un chantier (slice
vertical) à la fois.

Ce document couvre **uniquement le Chantier 1** : fondations (scaffold, PWA, CI, Supabase local,
Auth + RBAC + RLS, comptes seed) + **module Restos** de bout en bout. Les chantiers suivants sont
décrits au niveau roadmap pour garantir la cohérence du modèle de données, mais ne sont pas
implémentés ici.

---

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Supabase local | **Supabase CLI + Docker** : stack complète locale (Postgres/Auth/Storage), seed SQL versionné, reset reproductible. |
| Enrichissement restos (Chantier 1) | **Abstraction `PlacesProvider` + adapter mock d'abord**. Slice end-to-end et testé sans clé ni coût. Adapter Google Places réel codé et prêt, activé quand la clé est fournie. **On stocke le `place_id`, jamais les photos.** |
| Propagation RBAC pour RLS | **Custom Access Token Hook → claim JWT.** Le rôle vit dans `profiles.role` et est injecté dans le JWT ; les policies RLS le lisent depuis le token (pas de jointure par requête). |
| Authentification | **Email + mot de passe** (avec confirmation email). OAuth/magic link reportés à un chantier ultérieur. |

### Défauts techniques assumés (modifiables)
- i18n : `next-intl` (FR par défaut, architecture multi-locale dès le départ).
- Tests : **Vitest** (unitaire, logique métier) + **Playwright** (e2e, parcours critiques).
- Validation runtime des entrées serveur : **Zod**.
- Sessions Next.js ↔ Supabase : `@supabase/ssr`.
- Types : **générés** depuis le schéma (`supabase gen types`) — source de vérité unique.

---

## 2. Architecture & arborescence

### Principe de couches (non négociable)
- `app/` — pages & routing uniquement (Server Components par défaut).
- `features/<module>/` — logique métier (domain pur + accès données). **Aucune logique métier
  dans les composants.**
- `lib/` — infrastructure (clients Supabase typés, services API externes encapsulés, i18n, RBAC).
- `supabase/` — source de vérité (migrations SQL versionnées, seed, config).

```
vito/
├─ supabase/
│  ├─ migrations/            # SQL versionné (00001_init, 00002_rbac, 00003_restos…)
│  ├─ seed.sql               # 3 comptes + données restos de démo
│  └─ config.toml            # auth hook, storage, etc.
├─ src/
│  ├─ app/
│  │  └─ [locale]/           # routing i18n (fr par défaut)
│  │     ├─ (auth)/          # login, signup (non authentifié)
│  │     ├─ (app)/           # shell authentifié client/agence
│  │     │  └─ restos/       # module Restos (Chantier 1)
│  │     ├─ (admin)/         # back-office (chantier ultérieur, gate admin)
│  │     └─ api/             # route handlers : proxy Places + proxy photos
│  ├─ features/
│  │  └─ restos/
│  │     ├─ domain/          # logique pure, testable unitairement (pas d'I/O)
│  │     ├─ data/            # Server Actions + requêtes (RLS-aware)
│  │     └─ ui/              # composants du module
│  ├─ components/            # UI partagée présentationnelle
│  ├─ lib/
│  │  ├─ supabase/           # client browser / server / admin (service role)
│  │  ├─ services/places/    # PlacesProvider (interface) + adapter mock + adapter Google
│  │  ├─ services/llm/       # abstraction Anthropic (classification — câblé, activé plus tard)
│  │  ├─ rbac/               # permissions (vérif serveur ET ui)
│  │  └─ i18n/
│  ├─ types/database.types.ts  # GÉNÉRÉ — source de vérité des types
│  └─ test/
├─ e2e/                      # Playwright (parcours critiques)
├─ messages/fr.json          # i18n
├─ middleware.ts             # session auth + résolution locale
├─ .github/workflows/ci.yml  # typecheck + lint + unit + e2e (bloquant)
└─ manifest + service worker # PWA installable dès le départ
```

### Stack (imposée)
Next.js App Router, TypeScript strict (`strict`, `noUncheckedIndexedAccess`), Tailwind, PWA,
Supabase (Postgres), Vercel (preview par PR, prod sur `main`).

---

## 3. Modèle de données initial

Modèle conceptuel complet, avec le chantier de livraison de chaque table. Seules les tables
`[C1]` sont créées dans ce chantier.

### Identité & RBAC
- `app_role` — enum `client | agence | admin` (extensible). `[C1]`
- `profiles` — 1:1 avec `auth.users` : `id`, `role`, `display_name`, `locale`, `created_at`. `[C1]`
- Custom Access Token Hook → injecte `role` dans le JWT. `[C1]`

### Restos / Hôtels (le slice)
- `etablissements` — **référentiel partagé** (pas par-utilisateur) : `id`, `place_id` (unique),
  `categorie` (resto/hotel), `type` (étoilé/bistrot/brasserie… — rempli par classification),
  `nom`, `adresse`, `ville`, `code_postal`, `arrondissement`, `lat/lng`, `telephone`, `website`,
  `price_level`, `source`, `enriched_at`. **`place_id` stocké, jamais les photos.** `[C1]`
- `tags` — taxonomie extensible : `slug`, `label`, `categorie` (ambiance…), `is_system`. `[C1]`
- `liste_items` — relation perso user↔établissement (remplace des tables `listes`/`favoris`
  séparées) : `id`, `user_id`, `etablissement_id`, `statut` (`a_faire | visite`), `is_favorite`,
  `montant_par_personne`, `added_at`. `[C1]`
- `liste_item_tags` — N:N entre item perso et tags (les tags sont la classif **perso**). `[C1]`
- `avis` — notes/avis perso libres, **plusieurs par établissement** : `id`, `user_id`,
  `etablissement_id`, `note` (nullable), `commentaire`, `visite_le`, `created_at`. `[C1]`

### Chantiers suivants (référencés pour cohérence)
- Vins `[C2]` : `vins` (perso, lien optionnel vers `avis`/`etablissement`, `achat_url`).
- Goûts & reco `[C3]` : `profil_gouts` (jsonb, affiné en continu).
- Voyages `[C4]` : `voyages`, `voyage_membres`, `reservations` (coordonnées conciergerie hôtel),
  `documents_voyage` (numéros **chiffrés**, données sensibles).
- Tricount `[C5]` : `tricount_depenses`, `tricount_parts`.
- Abonnement & conciergerie `[C6]` : `abonnements`, `abonnement_membres`, `demandes_conciergerie`,
  `conciergerie_messages`.
- Famille & partage `[C7]` : `familles`, `famille_membres`, `agence_clients`.
- Back-office `[C8]` : vues/agrégats admin (lecture transverse via policies admin).

---

## 4. Sécurité (RLS / RBAC) — non négociable

- **RLS activée sur CHAQUE table dès sa création.** Aucune exception.
- **Données perso** (`liste_items`, `liste_item_tags`, `avis`) : policies `user_id = auth.uid()`
  (CRUD owner-only). Admin : lecture via claim JWT `role = 'admin'`.
- **Référentiel `etablissements` / `tags`** : lecture pour tout authentifié ; **écriture interdite
  en direct** → uniquement via **RPC `security definer`** appelée par le flux d'enrichissement
  (le serveur fait foi, jamais l'UI).
- **RBAC à deux niveaux** : le rôle dans le JWT pilote les policies RLS (serveur = autorité) ; un
  helper `lib/rbac` masque l'UI non autorisée (confort, jamais comme garde-fou).
- **Enrichissement Places conforme** : `place_id` stocké, **photos servies à la volée** via un
  route handler proxy (références courte durée), jamais persistées. Champs texte mis en cache avec
  `enriched_at` + refresh.

### Arbitrages signalés
- ⚠️ **RGPD / données sensibles** : `documents_voyage` (passeports…) → chiffrement applicatif des
  numéros (clé hors DB), pas seulement RLS. À cadrer en `[C4]`.
- ⚠️ **ToS Google Places** : pas de stockage de photos → proxy à la volée (impact perf/quota
  accepté).
- ⚠️ **Coût LLM** (classification étoilé/bistrot) : abstraction `services/llm` câblée mais
  **désactivée par défaut**, activée après validation budget. En `[C1]`, `type` est rempli par
  fallback (price_level / mots-clés Places) **sans coût LLM**.

### Secrets à configurer (jamais inventés)
- Clé Google Places API + facturation GCP (pour activer l'adapter réel).
- Clé API Anthropic (pour activer la classification LLM).
- Secret du Custom Access Token Hook / clés Supabase (local fournies par la CLI ; prod à configurer
  sur Vercel + Supabase cloud le moment venu).

---

## 5. Slice vertical Chantier 1 (Module Restos, bout en bout)

Parcours livré et **testé** :
1. **Auth + RBAC** : signup/login email+password, 3 comptes seed (client/agence/admin),
   redirection selon rôle, RLS vérifiée.
2. **Ajout d'un resto** : recherche par nom → `PlacesProvider` (mock en dev) **pré-remplit** la
   fiche → upsert dans `etablissements` via RPC + création du `liste_item` perso.
3. **Tags & favoris** : tags d'ambiance multi-valués, favori, statut à faire/visité.
4. **Fiche enrichie** : infos pré-remplies + **photos à la volée** (proxy conforme).
5. **Avis perso** : une ou plusieurs notes/avis libres par établissement.

### Comptes seed (dev local)
- 1 client (profil type « moi »).
- 1 agence de voyage.
- 1 admin (back-office complet).

### Stratégie de tests
- **Unitaire (Vitest)** : `features/restos/domain` (logique pure, sans I/O).
- **e2e (Playwright)** : « ajouter un resto → tagger → favori → avis ».
- **CI bloquante** : typecheck + lint + unit + e2e sur chaque PR.

---

## 6. Roadmap (un slice vertical par chantier)

| # | Chantier | Contenu | Tables clés |
|---|----------|---------|-------------|
| **1** | **Fondations + Restos** | Scaffold, PWA, CI, Supabase local seedé, Auth+RBAC+RLS, slice Restos complet | `profiles`, `etablissements`, `tags`, `liste_items`, `avis` |
| 2 | Vins | Capture depuis l'avis, onglet « mes vins », lien marchand (abstrait) | `vins` |
| 3 | Recherche & Reco | Onboarding goûts, recherche par critères, « ma liste d'abord » + ~10 recos | `profil_gouts` |
| 4 | Voyages | Réservations, coordonnées conciergerie hôtel, documents **chiffrés**, partage | `voyages`, `reservations`, `documents_voyage` |
| 5 | Tricount | Répartition dépenses de groupe | `tricount_*` |
| 6 | Abonnement + Conciergerie | « Laisse-toi porter », vue partagée qui/quand, chat conciergerie (payant) | `abonnements`, `demandes_conciergerie` |
| 7 | Famille & Partage | Familles/membres, partage voyages, rôle agence dépose docs/voyages | `familles`, `agence_clients` |
| 8 | Back-office admin | Suivi users/abonnements/demandes/activité | vues admin |

---

## 7. Sous-étapes du Chantier 1 (ordre du brief)

1. Plan d'architecture (ce document) — **validé**.
2. Scaffold : Next.js + Supabase local + PWA + CI + comptes seed.
3. Auth + RBAC (client/agence/admin) avec RLS.
4. Slice vertical Restos, de bout en bout, testé.

Chaque sous-étape s'arrête pour validation aux points clés.
