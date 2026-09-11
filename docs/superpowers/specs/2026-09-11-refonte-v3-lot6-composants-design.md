# Refonte v3 — lot 6 : les huit composants

## Pourquoi le lot 6 passe devant les lots 1 à 5

Le canevas numérote les composants en dernier. L'ordre est faux pour nous : les
cinq autres lots les consomment. Les dessiner après, c'est redessiner cinq fois
la même pastille — et c'est déjà arrivé. **108 éléments en forme de pastille
vivent aujourd'hui en ligne dans 65 fichiers**, sans composant pour les tenir.
Livrer les écrans d'abord en ajouterait une sixième famille.

Le périmètre a été tranché par le PO : ce lot construit les huit composants
**et migre les copies existantes**, avec un garde-fou qui interdit d'en
réécrire une. C'est la logique du lot 0, qui a migré les 79 rayons plutôt que
de poser les jetons et partir.

## Ce que ce lot corrige, et que le canevas ne demandait pas

Trois défauts trouvés en lisant le code pour écrire ce spec. Aucun n'était au
programme ; tous relèvent de ce lot, parce qu'ils vivent exactement dans les
composants qu'il refait.

### 1. Le bouton primaire écrit blanc sur l'accent

`Button.tsx` pose `bg-accent text-white`. En thème sombre, c'est `#FFFFFF` sur
`#6BA5FF` : **2,48:1**. Le seuil WCAG pour du texte est 4,5:1.

C'est la même paire, à l'envers, que celle qui a décidé le thème clair du lot 0.
Ce spec-là avait mesuré que l'accent `#6BA5FF` de la maquette tombait à 2,48:1
sur blanc et l'avait refusé pour cette raison — sans voir que le bouton primaire
servait déjà cette paire dans l'autre sens, dans le thème par défaut.

Le lot 0 a créé le rôle `--on-fill` (`#0A1220` en sombre) précisément pour ce
cas, l'a couvert d'un seuil de test… et **rien ne l'utilise**. Le canevas, lui,
écrit bien `#0A1220` sur l'accent : **7,54:1**.

Et ce n'est pas un défaut isolé. `text-white` posé sur un aplat d'accent
apparaît dans **27 fichiers** ; `text-white` tout court, 39 fois sur 33
fichiers. `Button` a 68 consommateurs et une seule édition les corrige — mais
**16 de ces aplats sont des boutons faits main qui contournent `Button`**
(`bg-accent px-4 py-2.5 font-semibold text-white` recopié à la main), plus
`Fab`, `Avatar` et `NavItem`, qui ont chacun leur propre copie.

C'est la mesure qui l'a montré : compter les consommateurs de `Button` donnait
« une édition, 68 fichiers réparés » et aurait laissé les 16 autres intacts.
Corriger le composant ne suffit donc pas — il faut aussi ramener à lui ceux qui
l'évitent, et un garde-fou pour que le 17e ne s'écrive pas.

### 2. La pastille de cluster refait le même défaut, et le garde-fou est aveugle

`CategoryMap.tsx:50` et `CaveMap.tsx:22-23` construisent leur pastille en HTML
de marqueur Leaflet avec `background:var(--accent);color:#fff;border:2px solid
#fff`. Même 2,48:1, à deux endroits de plus.

Le garde-fou des teintes littérales du lot 0 ne les voit pas : son motif exige
`#[0-9A-Fa-f]{6}`, donc **une notation hexadécimale à trois chiffres passe au
travers**. Il y a quatre `#fff` dans `src/`, tous invisibles au test qui prétend
les interdire. Le trou vient du lot 0 ; ce lot l'élargit à `{3}` et migre les
quatre.

### 3. Le marqueur « testé » est gris là où la v3 le veut vert

`pinHtml` dessine le statut *testé* en `var(--color-faint)`, conformément au
design Resto v2 qu'il cite en commentaire. Le canevas v3 le dessine en
`#3ED598` (`--kpi-green`). C'est un changement délibéré du designer, pas un
oubli : les trois statuts y deviennent trois couleurs, et non deux couleurs et
un gris. On l'adopte.

## La source

Canevas Claude Design `d919066c-ab09-4b48-a918-77f67a267241`, fichier
`refonte v3 - ecrans.dc.html`, bloc `data-screen-label="Composants"` (« Lot 6 ·
Composants · 25 · États : défaut, hover, focus visible, actif, désactivé,
chargement »). Toutes les valeurs ci-dessous en sont relevées, pas devinées.

Deux variantes ne figurent pas sur la planche et n'apparaissent que dans
l'écran `M · Fiche adresse` : le **TagChip avec croix de retrait**, et la bande
de **tags suggérés**. Un composant écrit d'après la seule planche les aurait
manquées.

L'écran de fiche tranche aussi une ambiguïté : le `StatusToggle` y est placé
sous le titre, au-dessus de « Déjà testé le 14 juin 2026 ». C'est un
**réglage**, pas un filtre. Le filtre à compteurs, ce sont les `SubTabPills`.

## Les valeurs du canevas et la table des jetons

Le garde-fou du lot 0 interdit toute teinte littérale hors d'une liste close.
Chaque valeur du canevas doit donc se résoudre en un rôle — ou le rôle doit
exister. Le relevé :

| Canevas | Rôle | Emploi |
|---|---|---|
| `#6BA5FF` | `--accent` | fond du bouton, marqueur favori, pastille |
| `#8FBCFF` | `--accent-hover` | survol du bouton |
| `#0A1220` | `--on-fill` | texte sur tout aplat d'accent, d'ambre ou de vert |
| `#EEF2F9` | `--ink` | fond des états *actifs* (TagChip, SubTabPill, ViewSwitcher) |
| `#93A0B8` | `--muted` | libellé d'un onglet inactif |
| `#6E7C95` | `--faint` | libellé désactivé, légendes |
| `#1C2432` | `--surface-hover` | fond des pastilles et des champs |
| `#232D3E` | `--badge` | bouton désactivé, survol de champ, bouton d'effacement |
| `#131A26` | `--surface` | fond du cluster |
| `#0C121D` | `--sidebar` | contour des marqueurs sur la carte |
| `#3ED598` | `--kpi-green` | marqueur *testé*, pastille « valeur sûre » |
| `#F5A65B` | `--kpi-amber` | marqueur *à tester*, CountBadge d'alerte |
| `rgba(255,255,255,.08)` | `--line` | bordure au repos |
| `rgba(107,165,255,.14)` | `--accent-50` | halo de focus, fond de SectionLabel |

### Les deux rôles que la table doit gagner

Le canevas emploie deux valeurs qu'aucun rôle ne porte. Les écrire en dur est
interdit, et les remplacer par un rôle voisin effacerait un état que le
designer a dessiné exprès. On les ajoute donc à la table, comme le lot 0 a
ajouté `--on-fill` et `--shadow` :

- **`--accent-active`** — le bleu de l'état *pressé* du bouton primaire.
  Sombre `#4D8DFF` (canevas), `--on-fill` dessus : **5,86:1**.
  Clair `#17479A`, `--on-fill` dessus : **8,73:1** — distinct de
  `--accent-hover` clair (`#1F57B4`, 6,82:1), donc le pressé se voit.
- **`--line-strong`** — la bordure des états survolés, que le canevas monte à
  16–18 % là où `--line` est à 8 %. Sombre `rgba(255,255,255,.16)`, relevé du
  canevas. La contrepartie claire proposée, `#C3CDDC`, est en revanche
  **dérivée, pas mesurée** : aucun seuil WCAG ne contraint une bordure, donc
  rien ne la valide automatiquement. Elle doit être regardée à l'œil, comme les
  autres rôles dérivés du lot 0. Sans ce rôle, le survol d'un TagChip ou d'un
  champ ne se distingue plus du repos en thème clair.

Les deux entrent dans les deux thèmes et dans `@theme` : les tests de parité et
d'exposition du lot 0 l'imposent, et échoueront sinon.

### Les valeurs du canevas qu'on n'ajoute PAS à la table

Y ajouter un rôle par nuance la ferait enfler sans rien décrire. Chacune de
celles-ci se résout dans un rôle existant, et la substitution est mesurée :

- **`#2A1A08`** (texte du CountBadge ambre) → `--on-fill`, qui donne **9,36:1**
  sur `--kpi-amber`. Le brun du canevas n'apporte rien qu'un rôle de moins.
- **`#323D50`** (bouton d'effacement du champ) → `--badge`, qui est déjà plus
  clair que le fond du champ et remplit la même fonction.
- **`#161E2C`** et **`#4A5566`** (champ hors connexion) → `--surface` et
  `--faint`. Le canevas applique déjà `opacity:.6` à la rangée entière ; c'est
  elle qui porte l'état, pas deux teintes de plus.
- **`rgba(62,213,152,.1)` / `.24`** (fond et bordure des StatTile) →
  `bg-kpi-green/10` et `border-kpi-green/24`. Le modificateur d'opacité de
  Tailwind s'applique au jeton de ton : aucun littéral, aucun rôle nouveau, et
  la bordure teintée que le canevas dessine devient exprimable. Les jetons
  `--kpi-*-bg` existants restent pour leurs consommateurs actuels.

## Les huit contrats

Chaque composant est décrit par ce qu'il fait, ce qu'il expose, et **ce qu'il
refuse** — c'est le refus qui empêche un écran de le détourner.

### 1. `Button`

Existe. Trois variantes (`primary`, `ghost`, `subtle`) et un `pending`.

Ce qui change : `text-white` → `text-on-fill` ; les six états du canevas
(défaut, survol, focus visible, **pressé**, désactivé, **chargement**) au lieu
de trois. Le désactivé devient `--badge` / `--faint` — un aplat éteint — au
lieu d'`opacity-60`, qui délavait aussi le texte. Le chargement montre un
disque qui tourne, et non plus seulement un bouton inerte.

Refuse : de porter une couleur par sa valeur. Un écran qui veut un bouton rouge
passe par une variante, pas par `className`.

### 2. `TagChip`

N'existe pas. Six variantes au canevas, deux de plus à la fiche :
repos, survol, **sélectionné** (fond `--ink`, texte `--on-fill`, compteur à
`opacity:.5`), **à pastille** (point de couleur, ex. « valeur sûre » en
`--kpi-green`), **vide** (compteur 0, `opacity:.5`, non cliquable),
**ajout** (bordure tiretée en accent), **retirable** (croix), **suggéré**.

Refuse : d'être un bouton. Un chip qui filtre est un `<button>` ; un chip qui
décrit n'est pas cliquable. Le composant prend la décision, pas l'écran.

### 3. `SearchField`

N'existe pas ; `Input` est générique et ne porte ni icône ni effacement.
Quatre états : repos, survol, **focus** (bordure 1,5 px en accent + halo
`--accent-50`, et bouton d'effacement), **hors connexion** (éteint, inerte).

Refuse : de gérer la recherche. Il ne connaît ni débounce ni requête — il rend
un champ. Ce que la frappe déclenche appartient à l'écran.

### 4. `StatusToggle`

N'existe pas. Contrôle segmenté à trois positions sur `RestoStatut`
(`favori | a_tester | teste`). Le modèle s'y prête déjà : `restoStatut()`
dérive une partition **exclusive** de `is_favorite` + `statut`, et « favori
prime ». Actif = fond `--ink`, texte `--on-fill` (16,7:1). Le favori porte un
**cœur**, décision PO de ce lot (voir plus bas).

Refuse : d'écrire lui-même. Il émet un changement ; l'action serveur reste à
l'écran. C'est ce qui le rend testable sans base.

### 5. `PlaceMapMarker`

Existe en fonctions de chaînes HTML dans `CategoryMap.tsx`, dupliqué dans
`CarteActivites.tsx` et `CaveMap.tsx`. Quatre formes : goutte accent au cœur
découpé (*favori*), triangle ambre (*à tester*), carré arrondi **vert**
(*testé*), et cluster — cercle de 38 px, fond `--surface`, bordure 2 px accent,
chiffre en `--ink`.

Le cluster d'aujourd'hui est l'inverse : aplat d'accent, texte et bordure
blancs. C'est là que vivent deux des quatre `#fff`.

Refuse : de connaître Leaflet. Il produit le balisage d'un marqueur ; c'est la
carte qui l'enveloppe dans un `divIcon`. Sans cette limite, il n'est testable
que dans une carte.

### 6. `SubTabPills` & `ViewSwitcher`

`SubTabPills` : pastilles à compteur, actif en `--ink` / `--on-fill`, compteur
à `opacity:.55` ; inactif en `--surface-hover` bordé, compteur en `--faint`.
`ViewSwitcher` : deux segments (liste / vignettes) dans un rail, actif en
`--ink`, survol en `--badge`.

Aujourd'hui les deux sont noyés dans `CategoryTabs.tsx` (372 lignes).

Refuse : de router. Ils reçoivent une valeur et émettent un choix ; l'URL et
l'état appartiennent à l'écran.

### 7. `StatTile` & `CountBadge`

`Tile` existe et affiche son nombre en gras ; le canevas le veut en **serif**
(`--font-newsreader`, 24 px), sur un fond teinté à 10 % bordé à 24 %.
`CountBadge` : trois tons — accent, ambre, neutre — texte `--on-fill` sur les
deux premiers (7,54:1 et 9,36:1), `--muted` sur le neutre.

`Badge` existe déjà et n'a qu'un seul ton. `CountBadge` le remplace plutôt que
de vivre à côté — deux composants de pastille à compteur finiraient par
diverger — ce qui fait migrer ses cinq consommateurs actuels.

Refuse : de formater. Ils reçoivent un nombre déjà mis en forme — la locale
appartient à l'appelant, qui seul sait s'il compte des adresses ou des euros.

### 8. `Skeleton` & `SectionLabel`

`Skeleton` existe : `bg-line/60` et `rounded-control`. Le canevas dit `--badge`
et 12 px, avec une pulsation d'opacité de 1,5 s. Deux `animate-pulse` traînent
hors du composant.

`SectionLabel` existe mais n'a ni pastille ni filet. Le canevas en donne deux
variantes : **accentuée** (libellé en accent, pastille `--accent-50` bordée,
filet accent à 20 %) pour les sections qui sont à l'utilisateur (« Mes
favoris »), et **neutre** (libellé `--faint`, pastille `--badge`, filet
`--line`) pour ce qui vient d'ailleurs (« Ailleurs · Google Places »). La
distinction n'est pas décorative : elle dit ce qui est à soi et ce qui ne l'est
pas.

## Les décisions PO de ce lot

- **Le favori devient un cœur en accent.** L'or reste à la note Google. Ce
  n'est pas qu'un habillage : aujourd'hui « mon favori » et « note Google »
  portent la même ★ or sur la même carte. Après, l'or ne veut plus dire qu'une
  chose. Trois occurrences, toutes dans `PlaceCard.tsx`.
- **Le statut *testé* passe du gris au vert** sur la carte (voir plus haut).

## Le découpage en trois sous-lots

Les huit n'ont pas le même risque. Les livrer ensemble ferait relire un
changement de `bg-line/60` avec la même attention qu'une écriture en base.

- **6A — les primitives déjà là, et la fin du blanc sur accent.** `Button`,
  `Skeleton`, `SectionLabel`, `StatTile`, `CountBadge`, plus les deux rôles de
  table et l'élargissement du garde-fou aux hexadécimaux à trois chiffres. Y
  compris le ramassage des **16 boutons faits main** vers `Button`, et de
  `Fab` / `Avatar` / `NavItem` vers `--on-fill`. C'est le sous-lot qui rend le
  2,48:1 impossible à réécrire.
- **6B — les composants de liste et de filtre.** `TagChip`, `SearchField`,
  `SubTabPills`, `ViewSwitcher`, et la migration des copies en ligne.
  C'est le volume, et il demande un tri : les 108 relevés ne sont **pas** 108
  `TagChip`. On y trouve des pastilles de filtre, des badges de statut, des
  compteurs de navigation et des tags décoratifs. Le plan de 6B doit les
  classer avant d'en migrer un seul — traiter le 108 comme un total à convertir
  produirait des composants détournés, ce que chaque contrat ci-dessus refuse
  explicitement.
- **6C — les deux composants à état.** `StatusToggle` (il commande une écriture)
  et `PlaceMapMarker` (carte, supercluster, tuiles 512 — le terrain qui a déjà
  mordu sur le rayon de cluster et le cadrage vide).

Un plan d'implémentation par sous-lot. Ce spec vaut pour les trois : les huit
partagent une géométrie de pastille et une échelle d'états, et les spécifier
séparément les ferait diverger.

## Ce que ce lot ne fait pas

- Il ne redessine **aucun écran**. Les écrans des lots 1 à 5 restent en place ;
  ils changent d'apparence seulement là où ils consomment un composant refait.
- Il ne touche **pas** aux treize autres primitives du kit (`Avatar`, `Card`,
  `Modal`, `Select`, `Toast`…). Le canevas n'en dit rien, et les rhabiller au
  jugé serait de l'invention.
- Il ne transforme **aucune pastille existante en `rounded-pill`** au-delà de
  ce que les composants portent eux-mêmes — la contrainte du lot 0 tient :
  changer la forme d'un élément, c'est réassigner son sens.
- Il ne règle pas le **défaut CSP des couvertures de voyage**, ouvert par
  ailleurs.

## Vérification

Chaque garde-fou de ce lot doit être **éprouvé par cassure délibérée** avant
d'être cru — la suite du dépôt a déjà montré qu'un test qui n'a jamais rougi
n'est qu'une opinion.

- Les seuils de contraste du lot 0 couvrent déjà `on-fill` sur `accent` ; il
  faut y **ajouter** `on-fill` sur `accent-active`, sur `kpi-amber` et sur
  `kpi-green`, sinon les trois nouveaux aplats ne sont tenus par rien.
- Le garde-fou des teintes passe à `{3,6}` hexadécimaux. Il doit échouer sur un
  `#fff` réintroduit, pas seulement sur un `#FFFFFF`.
- Un test doit interdire `text-white` hors d'une liste close. C'est le garde-fou
  qui compte le plus de ce lot : `--on-fill` est le rôle du texte posé sur un
  aplat, et les 39 `text-white` du dépôt sont autant de façons de le contourner
  sans qu'aucun test ne bronche. Il doit échouer sur un `text-white` réintroduit
  dans un composant.
- Un test doit interdire qu'un écran **réécrive** un composant migré : une
  pastille dessinée à la main hors de `shared/ui` est la dette que ce lot
  supprime, et rien n'empêche aujourd'hui la suivante.
- Les stories Storybook de chaque composant couvrent **tous** ses états —
  c'est le seul endroit où l'état *pressé* ou *hors connexion* se regarde.
- `npm run lint && npx tsc --noEmit && npm test && npx knip`, puis
  `supabase db reset && npm run test:e2e`. Les e2e sont le seul endroit où un
  composant qui rogne son contenu se voit.
