# Épic — Refonte Restos + onglet Hôtels (places) — Décisions & roadmap

> Directive PO du 2026-06-25 (template « PWA voyages »), réconciliée avec la réalité de Vito via audit
> Étape 0. Source de vérité des décisions pour l'épic.

## Décisions validées (PO)

1. **Réutiliser/étendre le modèle existant** — PAS de nouvelle table `places`. On s'appuie sur
   `etablissements` (`categorie 'resto'|'hotel'`, `lat`/`lng`, `place_id`, `type`, `price_level`,
   `website`, `telephone`), `liste_items` (`statut 'a_faire'|'visite'`, `is_favorite`, note),
   `tags`/`liste_item_tags`, `avis`. Zéro réécriture, zéro migration de données.
2. **Statut riche de Vito** — « À tester » = `statut='a_faire'` ; « Favoris » = `is_favorite=true`
   (cumulables ; un lieu visité peut rester favori). Bascule = toggle. PAS de binaire favorite|to_try.
3. **Carte** : `react-leaflet` + tuiles OpenStreetMap (gratuit, sans clé d'API).
4. **Fournisseur de recherche** : Google Places — **déjà intégré** (`searchPlaces`/details/photo,
   `GOOGLE_PLACES_API_KEY`, abstraction + mock). Aucune décision/coût supplémentaire.
5. **Réutilisation** : composants **génériques paramétrés par `categorie`** ; routes `/restos` +
   nouvelle `/hotels`.

## Seule évolution de schéma de l'épic
`tags` gagne un **scope** (`common`/`restaurant`/`hotel`) + une **couleur**. Tags hôtel/common seedés en
migration (comme les tags système existants, pour exister en prod). Le reste : aucune migration.

## Roadmap (6 slices, une PR chacune, spec→plan→subagent→PR→prod)
1. **Tags scopés + couleur** (migration 00017 + requête scope-aware + TagPicker couleur, sans casser
   `getTags()` utilisé par Goûts).
2. **Sous-onglets Favoris/À tester génériques** (paramétrés par catégorie) + vue **liste** + **recherche
   interne** (nom/ville/tag/note).
3. **Vues Vignettes + Carte** (react-leaflet) par sous-onglet.
4. **Carte combinée** (favoris + à tester, marqueurs distincts, filtres).
5. **Recherche externe priorisée** (favoris → à tester → Google), ajout 1 clic.
6. **Onglet Hôtels** (`/hotels`, composants génériques, `categorie='hotel'`) + nav RBAC.

## Hors périmètre / dette
- Conciergerie (demandes hôtel) et voyages (réservations) restent distincts du catalogue.
- `main` est protégée (garde-fou) → chaque slice passe par une PR + CI verte.
