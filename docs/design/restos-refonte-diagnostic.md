# Refonte onglet Restaurants — Diagnostic & décisions (PARQUÉ)

> Diagnostic Étape-0 du 2026-06-27, réconcilié avec la réalité Vito. **Travail parqué** : le PO a
> choisi de finir l'épic Famille (Slices 3→6) avant d'attaquer les Restos. Reprise sur « go Restos ».

## Maquette

`~/Desktop/Onglet Resto.dc.html` (14 écrans). **Pas encore committée** — à déposer dans
`docs/design/` au moment de la spec (le brief la disait committée : faux). Écrans : Favoris
(Liste/Vignettes/Carte/Vide) · Recommandés (Liste/Vide) · Carte combinée · Recherche
(Découverte/Résultats/Chargement/Fiche & ajout) · 3 écrans Web.

## Déjà en prod (~75 %) — à réutiliser, ne PAS reconstruire

- Modèle : `etablissements` + `liste_items(statut a_faire|visite, is_favorite)` (migr. 00003).
- Tags scopés : `tags` + `liste_item_tags` (00004/00017) + `TagPicker`.
- Composants : `places/ui` (`PlaceCard`, `PlaceSearch`, `PlacesMap`, `PlacesTabs`) +
  `restos/ui` (`FicheResto`, `FavoriteToggle`, `TagPicker`, `AvisForm`, `PhotoCacheSync`).
- Domaine pur : `filterPlaces.ts`, `mapCenter.ts` (testés).
- Recherche externe Google Places (`searchPlaces`/`details`, provider mock en test).
- Vue Liste + vue Carte (react-leaflet/OSM).

## Réellement nouveau

1. Restructuration IA en 4 sous-onglets **Favoris · Recommandés · Carte · Recherche**.
2. 3e vue **Vignettes** (grille 2 col., photo + cœur overlay) en plus de Liste/Carte.
3. **`reco_source`** (« Conseillé par {prénom} ») → **nouvelle colonne** `liste_items.reco_source text`
   (migration additive 00020, RLS héritée). Seul ajout schéma.
4. **Carte combinée** dédiée : favoris + recommandés, pins distincts + filtres tags.
5. Écran **Recherche « Découverte »** : champ + recherches récentes + « Explorer par envie ».
6. Versions **desktop** (3 maquettes) — slice dédiée.

## Mapping modèle (brief `places/status` → réalité Vito, plus riche — on garde Vito)

- Favoris = `is_favorite=true` · Recommandés = `statut='a_faire'` · Visités = `statut='visite'`.
- Tags du brief → `tags`/`liste_item_tags` existants.

## Décisions PO (2026-06-27)

1. **Filtres Recherche (MVP)** : **cuisine seule** (chips « Explorer par envie »), conforme maquette.
   Recherches récentes + chips d'envie. Pas de prix/distance/similaires au MVP.
2. **Statut visité** : le PO veut un **nouvel archivage séparé** (distinct de `statut='visite'`).
   ⚠️ À clarifier à la reprise : que signifie « archivé » fonctionnellement (masqué des listes
   actives ? distinct de « visité » ?). N'est PAS le simple réemploi de `statut='visite'`.
3. **Accent design** : **garder les tokens « Le Carnet »** (rounded-control, accent maison). Le bleu
   `#2563EB` + coins droits de la maquette sont un artefact du kit, pas une décision produit.
4. **Provider Places** : **Google** (déjà intégré en prod). Pas de Mapbox.

## Hors périmètre

Planning de réservations, conciergerie.
