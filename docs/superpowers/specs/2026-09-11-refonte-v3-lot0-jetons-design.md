# Refonte v3 — lot 0 : la bascule des jetons

**Date** : 11 septembre 2026 · **Statut** : à relire

## Constat

La refonte v3 tient en six lots. Aucun n'est le lot 0 : je l'ajoute, parce que
le dépôt en a déjà fait les trois quarts sans le savoir.

`src/app/globals.css` porte **deux palettes complètes nommées par leur rôle** —
`:root` sombre, `[data-theme="light"]` clair — et vingt-six rôles exposés à
Tailwind par `@theme`. Le designer avait promis que « basculer en clair
reviendra à réassigner la table, pas à redessiner » ; la table existe, et elle
marche déjà dans les deux sens.

Deux écarts seulement, et aucun n'est structurel :

1. **Le layout retombe sur le clair.** `src/app/[locale]/layout.tsx:53` lit le
   cookie et choisit `"light"` par défaut, avec un commentaire qui affirme que
   « toutes les maquettes sont claires, sans une seule variante sombre ». Ce
   commentaire est périmé depuis la refonte v3.
2. **Notre sombre n'est pas le sien.** Le nôtre est chaud — fond `#161310`,
   surface `#1E1A14`, encre crème `#F2EDE3` : un carnet de cuir. Celui de la
   maquette est froid — canevas `#080D16`, surface `#131A26`, encre `#EEF2F9`,
   accent `#6BA5FF`.

**Décision PO du 2026-09-11** : on adopte la palette froide et on abandonne le
grain chaud ; le mode clair est retendu en même temps, en neutre froid.

## Pourquoi ce lot vient en premier

Il ne reconstruit rien, et il change tout l'écran. Surtout, il **révèle** : une
fois la table froide en place, chaque endroit qui code une teinte en dur reste
chaud et se dénonce tout seul. Commencer par les composants (lot 6) nous
ferait les dessiner deux fois — une fois sur l'ancienne base, une fois après
la bascule.

## La palette, relevée et non devinée

Toutes les valeurs ci-dessous ont été **mesurées dans le canevas**
(`refonte v3 - ecrans.dc.html`, projet Claude Design
`d919066c-ab09-4b48-a918-77f67a267241`) par comptage d'occurrences et lecture
du contexte de chaque teinte. Les fréquences citées disent le rôle : une
couleur employée 282 fois en `color:` est l'encre primaire, pas un accident.

### Ce que la maquette dicte (thème sombre)

| Rôle | Valeur | Comment on le sait |
|---|---|---|
| `--app` | `#080D16` | fond du canevas et de `body` |
| `--surface` | `#131A26` | fond des cartes et panneaux (36×) |
| `--surface-hover` | `#1C2432` | surface levée, pastille non choisie (150×) |
| `--ink` | `#EEF2F9` | texte primaire (282×) |
| `--muted` | `#93A0B8` | texte secondaire (241×) |
| `--faint` | `#6E7C95` | libellés et légendes (232×) |
| `--accent` | `#6BA5FF` | action et lien (135×) |
| `--accent-hover` | `#8FBCFF` | `a:hover` de la feuille du canevas |
| `--accent-50` | `rgba(107,165,255,.14)` | voile d'accent (17×) |
| `--badge` | `#232D3E` | squelette `.sk` et badges (77×) |
| `--kpi-green` | `#3ED598` | statut « Testé » |
| `--kpi-amber` | `#F5A65B` | statut « À tester » |
| `--line` | `rgba(255,255,255,.08)` | **déjà la nôtre** (199×) |
| `--line-soft` | `rgba(255,255,255,.06)` | **déjà la nôtre** (32×) |

### Un rôle qui nous manque : `--on-fill`

La maquette pose deux teintes que notre table ne porte pas : `#0A1220` pour le
texte sur la pastille blanche de sélection, et `#0C121D` pour l'icône sur un
marqueur coloré. C'est le même besoin — **l'encre qu'on pose sur une surface
pleine** — et nous ne l'avons pas : vingt-sept endroits écrivent aujourd'hui
`text-white` sur `bg-accent`.

On ajoute donc `--on-fill`, `#0A1220` en sombre et `#FFFFFF` en clair. Le rôle
s'inverse avec le thème, ce qui est exactement ce qu'on attend de lui.

Ce lot **ne remplace pas** les vingt-sept `text-white` : il crée le jeton et le
documente. Le remplacement appartient aux lots de composants, qui savent
lesquels sont sur de l'accent et lesquels sur autre chose.

### Ce que la maquette ne peint jamais, et que je dérive

Quatre rôles n'apparaissent nulle part dans le canevas. Les inventer au hasard
serait le genre de choix qu'on ne peut plus contester six mois plus tard, donc
chacun porte sa raison — et chacun est **contestable par le designer**.

- **`--gold` reste `#E9B949`.** L'or marque l'étoile de notation. Un or froid
  n'est pas de l'or : la teinte porte le sens. Il tient largement le contraste
  sur `#131A26`.
  *Nuance à ne pas confondre avec un choix de jeton* : dans la v3, le
  **favori** n'est plus doré, c'est l'accent bleu (mesuré sur
  `PlaceMapMarker`). Or `PlaceCard.tsx:82` et `:117` peignent aujourd'hui le
  favori en `text-gold`. Ce déplacement est une décision de **composant**, pas
  de table — il appartient au lot des composants, et ce lot-ci n'y touche pas.
- **`--danger` devient `#F2707F`** (aujourd'hui `#F2998E`, un saumon chaud).
  Dérivé pour tomber dans la **même bande de clarté** que le vert `#3ED598` et
  l'ambre `#F5A65B` que la maquette donne : les trois statuts doivent se lire
  comme une famille. `--danger-bg` suit en `rgba(242,112,127,.14)`, le même
  voile à 14 % que tous les fonds de statut du canevas.
- **`--kpi-violet` reste `#C9A0F5`**, et `--kpi-violet-bg` prend son voile à
  14 %, `rgba(201,160,245,.14)`. Déjà froid. Le seul violet du canevas
  (`#C87BA0`) est un fond d'avatar, pas un statut — ce n'est pas une source.
- **`--hero-from` / `--hero-to` deviennent `#1C2432` → `#080D16`**, c'est-à-dire
  surface levée vers canevas : la même relation qu'aujourd'hui (`--surface-hover`
  vers `--app`), transposée.

`--sidebar` prend `#0C121D`, le neutre profond que la maquette emploie déjà
sous les zones de carte : plus sombre que la surface, distinct du canevas.

Restent quatre rôles qui se déduisent des précédents sans choix à faire, et
qu'on écrit en clair plutôt qu'en prose pour que deux lecteurs n'en tirent pas
deux valeurs :

- `--accent-600` : `#8FBCFF`, soit `--accent-hover` — c'est déjà la règle du
  bloc sombre actuel, où `--accent-600` et `--accent-hover` sont égaux.
- `--kpi-blue` : `#6BA5FF`, l'accent lui-même, comme aujourd'hui.
- Les trois fonds de statut prennent le **voile à 14 %** de leur propre teinte,
  qui est la constante du canevas (`rgba(107,165,255,.14)` y est posé 17 fois
  et c'est la seule opacité de fond employée) :
  `--kpi-green-bg` `rgba(62,213,152,.14)`, `--kpi-amber-bg`
  `rgba(245,166,91,.14)`, `--kpi-blue-bg` `rgba(107,165,255,.14)`.

### Le clair, contrepartie froide

Le designer a reporté le clair ; le PO veut le garder tenable. On le dérive
donc en **neutre froid** plutôt qu'en le laissant crème : mêmes rôles, même
accent de sens, contrastes vérifiés sur blanc.

`--app` `#F6F8FC` · `--sidebar` `#EDF1F8` · `--surface` `#FFFFFF` ·
`--surface-hover` `#EDF1F8` · `--line` `#DCE3ED` · `--line-soft` `#EAEFF6` ·
`--ink` `#0A1220` (la propre encre de la maquette, retournée) ·
`--muted` `#55617A` · `--faint` `#7C8799` · `--on-fill` `#FFFFFF` ·
`--badge` `#EAEFF6` · `--accent` `#2E6FD9` · `--accent-hover` `#1F57B4` ·
`--accent-50` `#E8F0FE` · `--gold` `#A97A10` · `--danger` `#B3261E` ·
`--danger-bg` `#FDECEA` · `--kpi-green` `#10814F` / `#E6F5EE` ·
`--kpi-amber` `#A85F18` / `#FBEEE2` · `--kpi-blue` `#2E6FD9` / `#E8F0FE` ·
`--kpi-violet` `#7B3FBF` / `#F1E9FB` · `--hero-from` `#DCE3ED` → `--hero-to`
`#F6F8FC`.

L'accent clair n'est **pas** `#6BA5FF` : à 3,0:1 sur blanc il échoue au texte.
`#2E6FD9` passe. Le sens de la teinte est conservé, sa valeur ne peut pas
l'être — c'est précisément ce que « nommer par rôle » permet.

## Les rayons

Question ouverte que le relevé impose, et que le périmètre approuvé ne
couvrait pas explicitement. Nos jetons disent `--radius-card: 4px`,
`--radius-tile: 4px`, `--radius-control: 3px`. La maquette compte 129 rayons à
`12px`, 46 à `9px`, 24 à `11px`, 22 à `10px`, et **153 à `999px`**.

Ce n'est pas un détail : la v3 est une interface ronde, la nôtre est carrée, et
la différence saute plus aux yeux que la couleur.

**Recommandation : les inclure dans ce lot.** Ils vivent dans la même table,
la bascule est du même geste, et l'objet du lot est que l'app *ait l'air* de la
refonte avant qu'on reconstruise quoi que ce soit. `--radius-card: 12px`,
`--radius-tile: 12px`, `--radius-control: 10px`, et un `--radius-pill: 999px`
nouveau, que 153 occurrences justifient.

Le risque est faible et visible : arrondir davantage peut révéler un rognage
sur un contenu qui débordait déjà. Le contraire — un jeton de rayon changé qui
casse une mise en page — n'existe pas.

**Si le PO préfère les garder pour le lot des composants**, ce lot livre la
couleur seule et le spec suivant reprend ce paragraphe tel quel.

## Ce qui code une teinte en dur

Quarante-quatre occurrences dans `src`. Trois nids comptent, les autres sont
des retouches.

**La table dupliquée du carnet hors ligne.** `src/app/[locale]/carnet-hors-ligne/[id]/page.tsx:115-121`
porte **les deux palettes en entier**, en styles inline. Ce n'est pas une
négligence : la page vit hors du groupe `(app)` pour que le verrou n'enferme
pas le lecteur dehors, et elle embarque donc ses styles. Elle doit être
retendue en même temps, et le spec le dit ici pour qu'on ne l'oublie pas —
c'est le genre d'oubli qui ne se voit qu'en avion.

**Deux ombres bleues.** `voyages/page.tsx:25` et `famille/page.tsx:35` portent
`shadow-[0_6px_16px_rgba(37,99,235,.35)]` : l'ancien accent, figé dans une
ombre. Invisible à tout grep de jetons, très visible sur fond froid.

**`statutTint.ts`** peint les couvertures de voyage en dégradés mi-chauds
mi-froids (`#4a4436`, `#2f5a3f`…), et `VoyageDetail.tsx:126` passe
`color="#211E1A"` à un `Avatar` — l'encre du thème clair, en dur, donc fausse
dans le thème sombre.

**Le `themeColor`.** `layout.tsx:27` est figé sur `#FBF9F3`, le crème clair,
avec un commentaire qui dit que le clair est le défaut. C'est la couleur que
remplissent la barre d'état iOS et la barre d'onglets Android : elle doit
suivre le thème, pas une constante.

## Ce que le lot ne fait pas

- Il ne reconstruit **aucun composant**. Les huit composants du lot 6, les
  pastilles segmentées, le commutateur de vues : plus tard.
- Il ne déplace **pas** le favori de l'or vers l'accent (décision de composant).
- Il ne remplace **pas** les vingt-sept `text-white` par `--on-fill`.
- **Les tuiles OpenStreetMap restent claires.** La carte sera une fenêtre
  lumineuse dans une coque nuit. La maquette assombrit cette zone, mais le
  choix des tuiles appartient au lot 4 — et c'est une dépendance externe, donc
  une décision à part entière.

## Vérification

- **Aucun rôle orphelin.** Un test unitaire lit `globals.css`, extrait les
  rôles déclarés dans chaque bloc de thème, et échoue si l'un existe d'un côté
  sans exister de l'autre. C'est l'erreur qui laisse une variable vide et un
  texte invisible, et elle ne se voit pas à la relecture.
- **Aucune teinte littérale.** Un test refuse tout `#rrggbb` ou `rgb(a)(…)`
  dans `src/`, hors `globals.css` et la page du carnet hors ligne, qui sont les
  deux seuls endroits autorisés à nommer une couleur. Il doit échouer si l'on
  réintroduit une ombre bleue en dur.
- **Le défaut est sombre.** Un test e2e lit le HTML servi et vérifie
  `data-theme="dark"` sans cookie, puis que le commutateur des réglages bascule
  toujours en clair et que le choix survit au rechargement.
- **Le carnet hors ligne suit.** Le test e2e du mode hors ligne vérifie que la
  page emportée rend la même surface que l'app, pas l'ancienne crème.
- **À l'œil, une fois.** Les rôles dérivés (`--danger`, le clair entier) ne se
  vérifient pas par un test : le PO les regarde sur un écran réel avant qu'on
  passe au lot suivant.

## Ce que ce lot remplace

Le commentaire de `layout.tsx:49-52` — « le CLAIR est le défaut : toutes les
maquettes sont claires, sans une seule variante sombre » — devient faux et doit
disparaître, en disant à sa place pourquoi le sombre est le défaut.
