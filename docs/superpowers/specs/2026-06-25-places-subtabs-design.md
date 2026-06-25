# Slice 2 (épic places) — Sous-onglets Favoris/À tester + recherche interne — Design

**Date :** 2026-06-25
**Statut :** Validé (décisions épic). Plan à suivre.
**Branche :** `restos-subtabs`

---

## 0. Contexte

Slice 2 de l'épic. La page Restos affiche aujourd'hui une **liste plate** (`RestoList` = tous les
`liste_items`). On la restructure en **sous-onglets Favoris / À tester** avec **recherche interne
instantanée**, via des **composants génériques paramétrés par catégorie** (réutilisés par les Hôtels en
slice 6). Réutilise `liste_items`/`etablissements`/`tags` (scopés en Slice 1) + le kit.

## 1. Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Sous-onglets | **Favoris** (`is_favorite = true`) et **À tester** (`statut = 'a_faire'`). Carte/Recherche → slices 3-5 (pas d'onglet mort maintenant). |
| Modèle riche | Cumulables : un lieu peut être favori **et** à tester. Cas assumé : un lieu *visité non favori* n'apparaît dans aucun des 2 onglets (historique consultable via la fiche). |
| Généricité | Nouveau dossier `src/features/places/` (data + ui) **paramétré par `categorie`** ; restos l'utilise avec `categorie="resto"`. |
| Recherche interne | **Filtre client instantané** de la liste perso chargée (nom / ville / tag), au fil de la frappe. La liste perso est bornée → pas de requête serveur par frappe. |
| Vue | **Liste** (cartes du kit) : nom, type, ville, étoile favori, **tags colorés** (Slice 1), lien vers la fiche. Vignettes/Carte → Slice 3. |

## 2. Données (`src/features/places/data/queries.ts`)

- `getPlaces(category: "resto" | "hotel")` → tous les `liste_items` de l'utilisateur dont
  `etablissement.categorie = category`, avec tags embarqués :
  ```ts
  supabase.from("liste_items").select(
    "id, statut, is_favorite, etablissement:etablissements!inner(id, nom, type, ville, arrondissement, categorie), tags:liste_item_tags(tag:tags(slug, label, color))"
  ).eq("etablissement.categorie", category).order("added_at", { ascending: false })
  ```
  (Filtre sur ressource embarquée via `!inner` + `.eq("etablissement.categorie", …)` — **l'implémenteur
  vérifie la syntaxe exacte PostgREST** ; alternative : `.eq("etablissements.categorie", …)`.) RLS owner
  (liste_items) s'applique. Type de retour : `Place[]` avec `tags: { slug, label, color }[]` aplatis.
- Helper pur `filterPlaces(places, query)` (testable) : insensible casse/accents, matche `nom`/`ville`/
  labels de tags.

## 3. UI générique (`src/features/places/ui/`)

- `PlacesTabs` (**client**, props `{ category, places }`) : état onglet (`favoris` | `a_tester`) + champ
  de recherche interne ; calcule la sous-liste = (tab favoris → `is_favorite` ; a_tester → `statut==='a_faire'`)
  puis `filterPlaces(sousListe, query)`. Rend `PlaceCard[]` ou un état vide. `data-testid` :
  `places-tabs`, `tab-favoris`, `tab-a-tester`, `places-search`, `place-card`.
- `PlaceCard` (présentational) : `Card` du kit — nom (lien `/restos/{etabId}` ; en slice 6 le lien
  dépendra de la catégorie), type + ville en `text-muted`, étoile si `is_favorite`, tags colorés
  (`Badge`/pastilles couleur). `data-testid="place-card"`.
- Intégration page restos : remplacer `<RestoList />` par `<PlacesTabs category="resto" places={await getPlaces("resto")} />`.
  Garder `PageHeader` + `GoutsBanner` + `RestoSearch` (ajout) au-dessus. `RestoList` peut être retiré
  (ou laissé inutilisé — préférer le retirer proprement).

## 4. i18n (`restos.*` ou nouveau `places.*`, 4 locales)

Ajouter des clés génériques (réutilisables hôtels) : `places.favoris`, `places.aTester`,
`places.searchPlaceholder`, `places.empty` (FR « Aucune adresse ici pour l'instant » + EN/IT/ES).
Choisir un **namespace `places`** dédié (générique) plutôt que `restos` (spécifique). Pas de chaîne en dur.

## 5. Sécurité

- Lecture seule, RLS owner sur `liste_items` (et embeds). Pas de migration, pas d'action modifiée.

## 6. Tests

- **Unit** : `filterPlaces` (match nom/ville/tag, casse/accents, query vide → tout).
- **e2e** : page restos → `places-tabs` visible ; onglet par défaut Favoris affiche les favoris seedés ;
  basculer sur `tab-a-tester` affiche les « à tester » ; `places-search` filtre la liste au fil de la
  frappe (ex. taper le nom d'un resto seedé → la carte reste, un terme absent → liste vide). Conserver le
  parcours d'ajout (`RestoSearch`) et la fiche. Suite complète verte. (Adapter les helpers/specs restos
  existants si un sélecteur de liste a changé — désambiguïsation, pas affaiblissement.)
- Build/typecheck/lint verts.

## 7. Arbitrages / dette

- Vignettes + Carte → Slice 3 ; Recherche externe → Slice 5 ; onglet Hôtels → Slice 6 (réutilise ces
  composants génériques avec `categorie="hotel"`).
- « Note » sur la carte de liste : différée (l'avis vit dans la fiche) ; on affiche nom/ville/tags/favori.
- Recherche serveur full-text : non requise (liste perso bornée → filtre client instantané).
