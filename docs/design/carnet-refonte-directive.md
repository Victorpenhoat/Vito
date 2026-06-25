# Épic — Refonte « Le Carnet » (nouveau design system) — Décisions & roadmap

> Directive PO du 2026-06-25. Source de vérité visuelle : maquette Claude Design
> `Vito Refonte.dc.html` (document canvas, 13 écrans, thèmes clair + sombre).
> Remplace le design system **Core.Badakan** (bleu nuit + Inter) par **« Le Carnet »**
> (crème/nuit chaude + serif éditoriale + cartes photo).

## Décisions validées (PO)

1. **Nouvel épic refonte d'abord** — l'épic « Restos + Hôtels » (places) est mis **en pause**.
   On adopte Le Carnet comme design system, on re-skinne l'app slice par slice, puis places
   reprend dans le nouveau style.
2. **Fondations d'abord** — une **Slice 0** dédiée (tokens + kit + shell) avant tout écran métier
   (évite de refaire les tokens 13 fois).
3. **Les deux thèmes** — clair (crème) **et** sombre (brun-nuit) livrés, via le toggle + cookie
   existants. **Le défaut reste sombre** (pas d'inversion demandée) — sombre = Le Carnet nuit.
4. **Vraies photos via cache** — `etablissements` gagnera une colonne `photo_ref` (migration
   additive, remplie une fois via Google `details`) pour les vignettes, au moment de la Slice Restos.
   Évite N appels Google par affichage.

## Langage visuel (extrait de la maquette)

| Token (nom conservé) | Clair | Sombre |
|---|---|---|
| `--app` / `canvas` (fond page) | `#FBF9F3` | `#161310` |
| `--sidebar` (surface 2) | `#F4F1E9` | `#110E0A` |
| `--surface` (carte) | `#FFFFFF` | `#1E1A14` |
| `--line` (bordure) | `#E4DDD0` | `rgba(255,255,255,.08)` |
| `--line-soft` (hairline interne) | `#F0EBE0` | `rgba(255,255,255,.06)` |
| `--ink` (texte) | `#211E1A` | `#F2EDE3` |
| `--muted` | `#7A736A` | `#A39A8A` |
| `--faint` (labels, placeholders) | `#9A9081` | `#6E665A` |
| `--accent` | `#2563EB` | `#4F8BF0` |
| `--gold` (étoile) | `#E9B949` | `#E9B949` |
| succès / alerte | `#15803D` / `#B45309` | `#7BE0A0` / `#B45309` |

- **Typo** : titres en **Newsreader** (serif, souvent italique pour citations/sous-titres) ;
  corps & UI en **Inter** (déjà présent). Labels de section en **petites capitales**
  (uppercase, `letter-spacing ~.14em`, 11px, `--faint`). Fonts via `next/font` (auto-hébergées,
  compatibles PWA/CSP — pas de CDN externe malgré le `<link>` Google de la maquette).
- **Formes** : coins très peu arrondis (**3px** contrôles, **4px** cartes/conteneurs — parti pris
  éditorial), bordures fines 1px, ombres discrètes `0 1px 3px rgba(0,0,0,.06)`.
- **Chrome** : sidebar avec wordmark « VITO » + sous-titre serif italique « le carnet », nav
  **groupée** (Carnet / Voyages / Cercle), actif = fond surface + liseré gauche accent + ink gras.
  Pages métier : eyebrow en petites capitales (accent) + H1 serif + sous-titre muted.

## Roadmap (8 slices, une PR chacune, spec→plan→subagent→PR→prod)

0. **Fondations** — tokens clair+sombre (`globals.css`), font Newsreader, re-skin du kit
   `shared/ui` (Button/Card/Badge/SectionLabel/PageHeader/NavItem…) + du shell (Sidebar groupée,
   wordmark, footer). Aucun écran métier ne change de contenu. e2e vert sans modification.
1. **Accueil** — dashboard Le Carnet (salutation serif, citation, bandeau stats, activité récente,
   à faire, à découvrir).
2. **Restos** — liste en **grille de vignettes photo** + onglets `Tous/Favoris/À tester/Visités`
   + fiche resto (hero photo). **Migration `photo_ref`** + remplissage Google.
   ⚠️ Livre de fait les vignettes visées par places-Slice-3.
3. **Vins** — liste vignettes + fiche dégustation.
4. **Recherche** — champ + filtres (pills) + résultats en lignes avec miniature.
5. **Voyages** — liste (prochain départ + carnet de route) + fiche voyage (hero, réservations,
   documents, voyageurs, dépenses).
6. **Dépenses** — détail + total + équilibre.
7. **Cercle** — Famille + Conciergerie + Abonnement.

Admin/Agence (absents de la maquette) héritent du kit re-skinné → cohérents sans écran dédié.

## Réconciliation avec l'épic places (en pause)

- Restos Le Carnet (Slice 2) **livre les vignettes + photos** visées par places-Slice-3.
- Restent pour places, **après** Le Carnet et **dans le nouveau style** : **Carte react-leaflet**
  (absente de la maquette — à dessiner dans l'esprit Le Carnet), **recherche externe priorisée**,
  **onglet Hôtels**.
- La maquette ajoute les onglets **Tous** et **Visités** (on n'avait que Favoris/À tester) →
  évolution produit à intégrer en Slice 2.

## Hors périmètre / dette

- `main` protégée (garde-fou) → chaque slice passe par PR + CI verte.
- Publication optionnelle du kit Le Carnet vers le projet claude.ai/design « Design System »
  (vide aujourd'hui) — à la fin de l'épic, non bloquant.
- IBM Plex Mono (présent dans la maquette mais inutilisé sur les écrans) : YAGNI, non intégré.
