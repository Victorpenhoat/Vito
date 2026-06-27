# Épic — Refonte Resto + Hôtels (brique générique) — Décisions & roadmap

> Directive PO du 2026-06-27, réconciliée avec la réalité Vito (diagnostic
> `docs/design/restos-refonte-diagnostic.md`) et les maquettes Claude Design committées
> (`docs/design/Onglet_Resto.dc.html`, `Onglet_Hotels.dc.html`). Source de vérité des décisions.

## Décisions validées (PO)

1. **Brique générique unique** paramétrée par catégorie : on **réutilise/étend** les composants
   `features/places/` existants (`PlaceCard`/`PlaceSearch`/`PlacesMap`/`PlacesTabs`) avec une **config
   par catégorie** — resto (★ /5 + libellés cuisine) vs hôtel (score /10 + classe étoiles + ambiance).
   **Pas de duplication** Resto/Hôtel.
2. **Notation = Google, stockée à l'enrichissement** : ajout d'une colonne `rating` (0-5, numeric) sur
   `etablissements`, remplie depuis Google details à l'upsert (comme `photo_ref`). Affichage : **★ rating /5**
   (resto) ; **score = rating × 2, /10** (hôtel). Une seule source, fonctionne hors-ligne.
3. **Archivage = `is_archived`** (drapeau sur `liste_items`) : un établissement archivé est **masqué des
   listes actives** (Favoris/Recommandés) mais reste consultable via un filtre/vue « Archivés ».
   **Orthogonal** à `is_favorite` et au `statut` (a_faire/visite).
4. **Filtres Recherche (MVP) = cuisine seule** (chips « Explorer par envie »), conforme maquette. Pas de
   prix/distance/similaires au MVP.
5. **Provider = Google** (déjà intégré en prod) ; **tokens = Le Carnet** (le bleu `#2563EB`/coins droits
   des maquettes est un artefact du kit — on garde `--accent` maison + `rounded-control`/`rounded-card`).
6. **Maquettes committées** dans `docs/design/` (référence visuelle versionnée).

## Réconciliation modèle (brief `places/status` → réalité Vito — on garde Vito, plus riche)

- Favoris = `liste_items.is_favorite=true` · Recommandés = `statut='a_faire'` + `reco_source` · Visités
  = `statut='visite'` · Archivés = `is_archived=true`.
- Tags = `tags`/`liste_item_tags` scopés (00017). Photos = cache (00018). Établissements partagés =
  `etablissements` (resto/hotel via `categorie`).

## Nouveautés data (migration 00020, additive)

- `liste_items.reco_source text` (« Conseillé par X » pour Recommandés).
- `liste_items.is_archived boolean not null default false` (+ `archived_at timestamptz`).
- `etablissements.rating numeric(2,1)` (0-5, Google) + `rating_count integer` (optionnel, nb d'avis).
- RLS inchangée (`liste_items` déjà owner-only ; `etablissements` lecture authentifiée). Types régénérés.

## Conventions Vito

- Mobile-first PWA, App Router Next 16, RLS partout, `Link`/`redirect` locale-aware
  (`@/lib/i18n/routing`), i18n 4 locales (parité), aucune chaîne en dur, aucun nouveau token.
- API externe (Google Places) **mockée en test** (`getPlacesProvider` mock). Secrets server-only,
  jamais en dur (`.env.example`). Tests RLS jamais contre la prod.
- TDD pour le domaine, e2e pour les écrans, review par task + review finale Opus, PR → CI verte →
  merge → prod (migration prod autorisée au « go prod » de la slice concernée).

## Roadmap (slices, une PR chacune, spec→plan→subagents→PR→prod)

1. **Migration 00020 + enrichissement rating** : colonnes `reco_source`/`is_archived`/`archived_at`
   (liste_items) + `rating`/`rating_count` (etablissements) ; remplissage `rating` depuis Google dans
   `mapPlaceToEtablissement` + `upsert_etablissement` ; types régénérés. (Migration prod.)
2. **Brique générique notation + config catégorie + vue Vignettes** : domaine pur `categoryConfig`
   (resto : ★/5 + cuisines ; hôtel : score/10 + classe étoiles + ambiances) ; `PlaceCard` étendu
   (notation selon catégorie, rendu liste **et** vignette). TDD. Appliqué à la liste existante.
3. **Restructure IA** : `PlacesTabs` → 4 sous-onglets **Favoris · Recommandés · Carte · Recherche** +
   toggle de vue **Liste / Vignettes / Carte**. Recommandés affiche `reco_source` (« Conseillé par X »).
   e2e.
4. **Carte combinée** : sous-onglet Carte dédié (favoris + recommandés sur une carte, **pins distincts**
   par catégorie/statut + **filtres par tags**). `PlacesMap` étendu.
5. **Recherche découverte** : écran Recherche (recherches récentes + « Explorer par envie » = chips
   cuisine + résultats Ajouter/Ajouté + fiche & ajout). S'appuie sur la recherche Google existante.
6. **Archivage** : action archiver/désarchiver (`is_archived`) + exclusion des listes actives + filtre/
   vue « Archivés ».
7. **Onglet Hôtels paramétré** : réaligner l'onglet Hôtels existant (#38) sur la refonte via la brique
   générique — score /10, classe étoiles, chips ambiance (Tous/Bord de mer/Boutique/Spa).
8. **Desktop** : versions Web des deux onglets (maquettes Web Resto + Web Hôtels).
9. **Polish + kit** : skeletons, états d'erreur, a11y ; **kit Claude Design** rafraîchi par le PO via
   `/design-sync` (je ne pousse pas le kit moi-même).

(Roadmap indicative — slices regroupables/réordonnables selon le PO. Hors périmètre épic : planning de
réservations, conciergerie.)

## Sécurité (rappel)

- RLS owner-only sur `liste_items` (les 4 verbes) ; `etablissements` lecture authentifiée. `is_archived`/
  `reco_source` modifiables uniquement par le propriétaire de la ligne. Google Places mocké en test ;
  clé server-only. Aucune donnée prod touchée par les seeds/tests.
