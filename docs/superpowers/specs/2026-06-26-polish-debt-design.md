# Slice Polish — dette transverse (arrondis + token erreur + addPlace + dates) — Design

**Date :** 2026-06-26
**Statut :** Validé (périmètre complet PO). Plan à suivre.
**Branche :** `polish-debt`

---

## 0. Contexte

Solde la dette transverse accumulée pendant les épics Le Carnet + places. **Purement
présentationnel + petits refactors** : `className` (arrondis, couleur d'erreur), 1 token, 1 dé-dup
d'action, 1 helper de date pur. Aucune logique métier, aucune migration. e2e = filet (testids/textes
inchangés).

## 1. Arrondis éditoriaux (cohérence Le Carnet)

`rounded-xl` / `rounded-lg` (25 fichiers, surtout des contrôles de formulaire) → **`rounded-control`**
(3px, token existant). `rounded-lg` n'apparaît que sur les boutons segmentés d'`AuthPanel` (contrôle
→ `rounded-control` OK). Remplacement **mécanique** des deux classes par `rounded-control` dans les
composants UI listés (jamais dans `globals.css`/`@theme`). Les `rounded-card`/`rounded-full`/
`rounded-control` existants sont conservés.

## 2. Token couleur d'erreur

Aujourd'hui `text-red-600` est codé en dur (~12 fichiers). Ajouter un token **`--danger`** dans
`globals.css` (clair + sombre) + mapping `@theme --color-danger`, puis remplacer `text-red-600` →
**`text-danger`** partout. Valeurs : clair `#B3261E`, sombre `#F2998E` (rouge lisible sur crème /
brun-nuit). (Les `error.tsx` de routes inclus s'ils utilisent `text-red-600`.)

## 3. Dé-duplication `addResto` / `addHotel`

`addResto` et `addHotel` partagent ~90 % du corps. Extraire **`addPlace(category: "resto" | "hotel",
formData: FormData)`** (auth → details → `mapPlaceToEtablissement(place, category)` → RPC →
`liste_items` upsert → `revalidatePath(category === "hotel" ? "/hotels" : "/restos")`).
`addResto`/`addHotel` deviennent des wrappers minces (signature `(_prev, formData)` inchangée → aucun
appelant impacté : `PlaceSearch` continue de référencer `addResto`/`addHotel`).

## 4. Dates localisées

Helper pur **`formatDay(iso: string | null, locale: string): string`** (`src/lib/format/date.ts`) :
`""` si nul, sinon `new Intl.DateTimeFormat(locale, { day:"numeric", month:"short", year:"numeric" })
.format(new Date(iso))` ; + **`formatRange(start, end, locale)`** (joint par « – », ignore les nuls).
Testable. Appliqué là où des dates ISO brutes s'affichent :
- `DepensesList` (client → `useLocale()`) : `d.date`.
- `VoyageDetail` (server → `getLocale()`) : dates de réservation + plage du voyage.
- `VoyageCard` (sync) : reçoit `locale` en prop depuis `VoyagesList` (server `getLocale()`).
- `VoyageFeatured` (server) : `getLocale()`.
- `VinDetail` (server) : `deguste_le` des dégustations.
- `abonnement/page.tsx` (server) : remplacer le `toLocaleDateString("fr-FR")` codé en dur par
  `formatDay(periodEnd, locale)` (`getLocale()`).

## 5. Sécurité

- Aucune migration, aucune RLS/action touchée fonctionnellement (`addPlace` = même logique fusionnée,
  mêmes gardes d'auth/RPC). Dates rendues côté client/serveur à partir de données déjà chargées.

## 6. Tests

- **Unit** : `formatDay`/`formatRange` (nul → "" ; ISO + locale fr/en → format attendu ; plage avec
  une borne nulle). Reste des suites inchangé. typecheck+lint+test verts.
- **e2e** : **toutes les suites vertes sans modification** — sweeps `className` + token + refactor
  ne changent ni testid ni texte ni flux (addResto/addHotel gardent leur signature ; PlaceSearch
  inchangé). Un `db reset` avant.
- **Build** : OK.
- Pas de nouveau test e2e (polish).

## 7. Arbitrages / dette restante (hors scope, assumée)

- **Tuiles carte offline** (cache SW) : volontairement hors scope (stockage + ToS OSM).
- **`searchPlaces` typé hotel/resto** : hors scope (filtrage par requête suffit au stade actuel).
- **Prix Premium réel / billing** : décision produit, pas un polish.
- Le sweep arrondis ne touche pas d'éventuels `rounded-*` volontaires hors contrôles (il n'y en a pas
  de problématique d'après l'audit).
