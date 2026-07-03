# Kit — contrôles natifs stylés (lot 2 audit visuel) — Design

**Date** : 2026-07-03 · **Origine** : audit visuel du 03/07 (52 captures) — les contrôles
natifs bruts jurent avec le kit : checkboxes « carrés blancs » (goûts, tags resto,
conciergerie, participants dépenses), dates natives sans thème (icône calendrier sombre
sur fond sombre), input fichier « Choose File No file chosen » (détail voyage).

## Décisions

- **Dates : habiller le natif, pas le remplacer.** Le « mm/dd/yyyy » de l'audit est un
  artefact du navigateur en-US de Playwright — un `<input type=date>` suit la locale du
  *navigateur* (jj/mm/aaaa pour un navigateur fr), comportement standard, et le picker
  mobile natif est imbattable. Un champ custom (format forcé par la locale de l'app)
  serait disproportionné (a11y, parsing, clavier). Décision par défaut (PO AFK), réversible.
- **Checkboxes : natif + `accent-color`, pas de re-implémentation.** Conserve la
  sémantique, l'a11y et les sélecteurs e2e `input[type=checkbox]` ; corrige couleur,
  taille (20 px) et espacement label.
- **Fichier : input `sr-only` + bouton stylé + nom du fichier**, libellés passés en props
  (les primitives du kit restent sans i18n, comme Button). `data-testid`/`name`/`accept`
  forwardés sur l'input pour que `setInputFiles` et les actions serveur restent intacts.

## Composants (src/features/shared/ui, pattern Input : label/error/className + spread, stories)

1. **`Checkbox`** — `{ label: ReactNode } & InputHTMLAttributes` ; label flex gap-2,
   input `h-5 w-5 accent-accent`, rangée avec padding vertical (zone de tap mobile).
   Server-compatible (pas de hooks).
2. **`DateField`** — clone d'`Input` avec `type="date"` forcé ; + règle globale
   `color-scheme` par thème dans globals.css pour l'icône calendrier (bénéficie à tous
   les inputs date/heure, convertis ou non).
3. **`FileField`** — client ; `{ label: string; emptyLabel: string }` ; input natif en
   `sr-only` (pas `display:none` : focus clavier + `setInputFiles` préservés) avec classe
   `peer`, bouton visuel `peer-focus-visible:outline`, nom du fichier sélectionné en
   `truncate` (état local).

## Applications (remplacements mécaniques, `name` et testids conservés)

- Dates → `DateField` : ReservationForm, VoyageForm, VoyagePourClientForm (agence),
  VinsFilters, DegustationForm, ProcheForm, DemandeRestoForm, DemandeHotelForm,
  RemboursementForm, DepenseForm (liste exacte = grep `type="date"`).
- Checkboxes → `Checkbox` : GoutsForm, TagPicker, DemandeRestoForm, DemandeHotelForm,
  DepenseForm (participants).
- Fichier → `FileField` : DocumentUploadForm (voyages) — DocumentTunnel (famille) est
  déjà stylé sr-only, hors scope. Libellés i18n (fr/en/it/es) dans `messages/*.json`.

## Tests & vérifs

- TDD : `FileField.test.tsx` (affiche emptyLabel, puis le nom du fichier après sélection,
  forwarde data-testid sur l'input).
- Stories pour les 3 primitives (convention kit) — le Vito Kit passera à 18 primitives
  → proposer un `/design-sync` au PO (jamais auto-poussé).
- Non-régression : e2e locaux ciblés (reco/gouts, restos tags, conciergerie, vins,
  voyages+documents, depenses, famille-ocr) + lint/tsc/unit + re-captures visuelles des
  pages incriminées + CI 3 passages.

## Hors scope (lots suivants)

Pluriels/`(owner)`/labels fuités (lot 3), KPI accueil et wording foyer (produit),
`hotels.spec` non-idempotent (jumeau de #72).
