# Slice 2 (épic Le Carnet) — Restos : vignettes photo + onglets + fiche hero — Design

**Date :** 2026-06-25
**Statut :** Validé (décisions PO). Plan à suivre.
**Branche :** `carnet-restos`
**Directive :** `docs/design/carnet-refonte-directive.md` · **Fondations :** Slices 0+1 (mergées)

---

## 0. Contexte

Slice la plus consistante de l'épic. On re-skinne **l'écran Restos** (liste + fiche) au style Le
Carnet d'après la maquette, et on introduit le **cache de référence photo** pour afficher de vraies
photos en vignette sans appel Google par ligne. Décisions PO validées : **onglet Tous par défaut**
(maquette) ; **un seul slice** (liste + fiche).

## 1. Stratégie photo (cache ToS-défendable)

La route `/api/places/photo` **streame les octets sans jamais les persister** (conformité ToS) — on
conserve ce comportement. On ne cache que la **référence** Google :

- **Migration 00018** : `etablissements` gagne `photo_ref text` (réf. Google) + `photo_fetched_at
  timestamptz` (fraîcheur). `place_id` reste la seule donnée cachée indéfiniment ; `photo_ref` est
  horodatée → réf > **30 jours** considérée périmée et rafraîchie.
- **Remplissage à l'ajout** : `upsert_etablissement(p jsonb)` (security-definer) est étendu pour
  écrire `photo_ref` + `photo_fetched_at=now()` quand `p.photo_ref` est fourni. `addResto` a déjà
  `place.photoRefs[0]` → `mapPlaceToEtablissement` ajoute `photo_ref`.
- **Remplissage paresseux à la consultation de fiche** : `FicheResto` calcule déjà `photoRefs` via
  `details()`. Nouvelle fonction security-definer `cache_etablissement_photo(p_etab uuid, p_ref text)`
  (update `photo_ref`/`photo_fetched_at=now()` où `id=p_etab`, RLS contournée car référentiel système
  en écriture-fonction ; grant `authenticated`). Un composant client `PhotoCacheSync` appelle l'action
  serveur correspondante **seulement si** la réf courante (`etab.photo_ref`) diffère de `photoRefs[0]`
  ou est périmée (>30 j) → met le cache à jour au fil des consultations. Zéro appel Google par ligne
  de liste.
- **Vignette sans réf** : visuel dégradé + initiale (placeholder), pas d'image cassée.
- **Seed/e2e** : les restos démo reçoivent `photo_ref='mock_photo_1'` (le provider mock renvoie une
  image data-URL) → les vignettes montrent une photo en dev/e2e.

## 2. Données (`src/features/places/data/queries.ts` + `restos/data`)

- `getPlaces(category)` : ajouter `photo_ref` à l'embed `etablissement` du `select` ; le type `Place`
  gagne `etablissement.photo_ref: string | null`. `statut` est déjà sélectionné.
- `getFiche(etablissementId)` : ajouter `photo_ref`, `photo_fetched_at` au `select` de
  `etablissements` (pour décider du sync paresseux).
- `mapPlaceToEtablissement(p)` : ajouter `photo_ref: p.photoRefs[0] ?? null` à `EtablissementInput`.

## 3. UI

### Onglets (`PlacesTabs`, client)
- 4 onglets : **Tous** (toute la liste) / **Favoris** (`is_favorite`) / **À tester** (`statut='a_faire'`)
  / **Visités** (`statut='visite'`), avec **compteurs** (calculés client sur la liste chargée).
  **Défaut = Tous.** Recherche interne (`filterPlaces`) conservée, appliquée à la sous-liste de
  l'onglet actif.
- `data-testid` : `places-tabs`, `tab-tous` (nouveau), `tab-favoris`, `tab-a-tester`, `tab-visites`
  (nouveau), `places-search`. `aria-selected` sur l'onglet actif.

### Vignette (`PlaceCard`, présentational)
- Carte Le Carnet : **bandeau photo** (via `/api/places/photo?ref={photo_ref}&w=...` ou placeholder
  dégradé+initiale) avec ★ si favori ; corps = type (petites capitales) + **nom serif** + ville +
  pied (note/statut). Lien vers `/restos/{etablissement.id}`. `data-testid="place-card"` conservé.
- Grille responsive (1 col mobile, 2 col `md:`) dans la page restos.

### Fiche resto (`FicheResto`)
- **Hero photo** : bandeau pleine largeur (image `photo_ref` ou 1ʳᵉ `photoRefs` + dégradé bas + titre
  serif + type·ville en surimpression), au lieu de la rangée de petites photos. ★ si favori.
  `data-testid="resto-photo"` conservé sur l'image du hero. Le reste de la fiche (avis, tags, vins,
  conciergerie, voyage) conservé, re-skinné via le kit (cartes « Infos pratiques » / « Étiquettes »
  en aside selon la maquette si simple ; sinon empilé). Testids `avis-form`, `tag-picker`,
  `tags-saved` **conservés**. Monte `PhotoCacheSync` (cf. §1).

## 4. i18n (`places.*`, 4 locales — parité garantie)

- Ajouts : `places.tous` (FR « Tous »), `places.visites` (FR « Visités »). `places.favoris`,
  `places.aTester`, `places.searchPlaceholder`, `places.empty` existent déjà.
- EN : « All » / « Visited ». IT : « Tutti » / « Visitati ». ES : « Todos » / « Visitados ».
- Pas de chaîne en dur ; les compteurs sont des nombres concaténés au libellé côté composant.

## 5. Sécurité

- Migration **additive** (2 colonnes), idempotente ; `create or replace` du RPC existant (grants
  préservés) ; nouvelle fonction `cache_etablissement_photo` **security-definer**, `search_path=''`,
  `revoke from anon` + `grant to authenticated`, écrit uniquement `photo_ref`/`photo_fetched_at`.
- Aucune donnée utilisateur touchée. Octets photo jamais persistés (proxy streaming inchangé).
- `photo_ref` horodatée (`photo_fetched_at`) → posture ToS défendable (réf bornée, rafraîchie).

## 6. Migration & prod (ordre)

Migration 00018 **additive + backward-compatible** → l'appliquer sur prod (Resto_Hotels) **avant**
le merge (au « go prod » de cette slice), comme les chantiers précédents, pour éviter une fenêtre où
le front interroge des colonnes absentes.

## 7. Tests

- **Migration** : `supabase db reset` applique 00001→00018 ; colonnes `photo_ref`/`photo_fetched_at`
  présentes ; fonction `cache_etablissement_photo` existe.
- **Unit** : `filterPlaces` inchangé (toujours vert) ; `mapPlaceToEtablissement.test` mis à jour pour
  asserter `photo_ref` ; typecheck+lint+test verts ; parité i18n verte (`tous`/`visites` × 4).
- **e2e** :
  - `places.spec.ts` : **mettre à jour l'assertion de défaut** — l'onglet **Tous** est `aria-selected`
    au chargement (au lieu de Favoris). Le reste (bascule À tester, recherche, comptes) reste valide
    (le seed = 1 resto « Le Bistrot Démo », favori + a_faire → Tous=1, Favoris=1, À tester=1,
    Visités=0). Changement **légitime** (nouveau comportement), pas un affaiblissement.
  - `restos.spec.ts` / `vins.spec.ts` : restent verts sans changement d'assertion — ils cliquent
    `tab-a-tester` ou prennent la 1ʳᵉ `place-card` (présente sous Tous par défaut). Les commentaires
    « Favoris par défaut » deviennent obsolètes (non bloquant ; rafraîchir le commentaire si trivial).
  - Vérifier la **photo de vignette** : un seed avec `photo_ref` → image présente sur une `place-card`
    (test léger optionnel, sinon couvert par le rendu).
  - `resto-photo` toujours visible sur la fiche (hero). Suite complète verte. Un `db reset` avant.
- **Build** : `npm run build` OK.

## 8. Arbitrages / dette

- **Backfill des lignes existantes** (prod) : non fait en masse ; les restos se remplissent à l'ajout
  et au fil des consultations de fiche (paresseux). Acceptable (peu de données prod aujourd'hui).
- **Rafraîchissement >30 j** : déclenché par le sync paresseux de fiche ; pas de job de fond (différé).
- Vue **Carte** (react-leaflet) : hors Slice (épic places repris plus tard).
- `Tile` toujours inutilisé sur ces écrans (kit conservé).
- Onglet **Hôtels** : épic places ultérieur (composants déjà génériques par `categorie`).
