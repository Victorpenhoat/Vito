# Écarts entre l'application et la maquette — Activités, 8 septembre 2026

Contrairement à Voyages, Resto v2 et Cercle (cf. `ECARTS-2026-09-05.md`), ce
chantier a été construit **avec la maquette en main** : `Onglet_Activites.dc.html`
est entré dans le dépôt le 7 septembre à 20h58 (#165), et les lots #166 à #174
ont suivi le 8 septembre. Cela s'entend dans le résultat : `semaine.conflit`,
`alertes.sousTitre`, `recherchePlaceholder` et `vide.semaineVacances` reprennent
la maquette **au mot près**.

Ce document liste ce que la comparaison révèle malgré cela. Il ne corrige rien.

> **État au 9 septembre, après #179.** Sept des onze écarts sont comblés, un
> l'est en partie, trois restent ouverts. Le détail est marqué **au fil du
> document** : chaque écart garde son constat d'origine lisible, avec la PR qui
> l'a comblé. Un document d'écarts qui se vide de son contenu perd sa valeur
> d'archive — dans six mois, savoir *pourquoi* le mode de règlement avait été
> oublié vaut mieux que constater qu'il est là.
>
> · **Comblés (#179)** : mode de règlement · « à la séance » · « soutien
>   scolaire » · puces de filtre retirables · en-tête nommant les filtres ·
>   second contact avec son rôle. **Comblé (#177)** : temps de trajet.
> · **En partie (#179)** : verbes d'alerte — trois au lieu de quatre, et
>   l'affectation diffère.
> · **Ouverts** : semaine desktop en 7 colonnes · covoiturage · autocomplétion
>   de l'adresse du club · swipe.

⚠️ **CET AUDIT A ENJAMBÉ DU TRAVAIL EN VOL — depuis résolu (mise à jour du
9 septembre).** À l'écriture, l'arbre portait 11 fichiers modifiés et 4 non
suivis, datés du 8 septembre 18h09–18h11, que `git log` ne montrait pas. Ce lot
— **temps de trajet** (`domain/trajet.ts`, clé `lieu.duree` = « ~{n} min depuis
chez nous »), **coordonnées du foyer** (migration `00057_foyer_coordonnees.sql`)
et **géocodage** de l'adresse du foyer (`features/famille/data/geocodage.ts`) —
a été mergé le 9 septembre à 10h25 (**#177**, `eebac54`). Les passages concernés
ci-dessous ont été corrigés en conséquence.

⚠️ **La leçon reste** : un audit daté décrit un dépôt à un instant, et un dépôt
peut porter du travail qu'aucune commande d'historique ne révèle. Vérifier
`git status`, pas seulement `git log`.

⚠️ **Portée de l'audit** : il compare la maquette au **code et aux 159 clés
i18n**. Il n'a **pas** été mené en pilotant l'application. Il attrape donc les
absences, pas les comportements faux : un écran peut exister, porter la bonne
chaîne, et mal se comporter. Les onze écarts ci-dessous sont vérifiés dans le
code ; la réciproque — « tout le reste est conforme » — ne l'est pas au même
degré.

---

## 1. Le mode de règlement est un champ mort — ✅ COMBLÉ (#179)

C'était l'écart le plus grave, et le seul qui touchait la donnée.

> **Comblé le 9 septembre** : `SectionCout.tsx` poste désormais `moyen`, et les
> libellés existent (`cout.moyen` = « Mode de règlement », les six valeurs, plus
> `cout.sansMoyen` = « Mode non précisé » — cet état vide était nécessaire, les
> échéances déjà saisies n'ayant aucun moyen).
> ⚠️ Le constat qui suit est **conservé parce qu'il explique comment ça arrive** :
> un chemin d'écriture complet de bout en bout sauf son premier maillon, sans
> qu'aucune erreur ne se lève.

| | |
|---|---|
| **Maquette** (écran 9) | « Mode de règlement : Prélèvement · Carte · Chèque · Espèces », et la fiche affiche « Cotisation annuelle — **Prélèvement** · 3 échéances » |
| **Construit** | La colonne `moyen` existe (migration `00055_activites.sql:145`, `check in ('prelevement','carte','virement','cheque','especes','autre')`), `queries.ts` la lit, `actions.ts:126` l'accepte depuis le `formData` — et **rien ne la remplit, rien ne l'affiche** |

Vérifié : aucun `name="moyen"` dans les composants, aucun `.moyen` rendu. Le
formulaire d'échéance (`SectionCout.tsx`) poste `activiteId`, `echeance`,
`libelle`, `montant`, `paiementId`, `paye`, `periodicite` — jamais `moyen`.

⚠️ **Rien ne lève d'erreur.** Le chemin d'écriture est complet de bout en bout,
sauf son premier maillon. C'est le même défaut que `nb_contrats_cddu` sur
l'autre projet : une colonne dont le seul rédacteur possible n'a jamais été
câblé, et qui reste donc vide sans que personne le sache.

Coût de reprise : un sélecteur dans `SectionCout`, six libellés i18n, un
affichage sur la fiche. Tout le reste est déjà là.

## 2. La semaine desktop n'a pas la forme dessinée — ⬜ OUVERT

| | |
|---|---|
| **Maquette** (« 2 · Cette semaine — **7 colonnes**, conflit, vacances ») | Grille de 7 colonnes datées (Lun. 7 → Dim. 13), **rail horaire 8h → 20h**, séances positionnées dans la grille, en-têtes de colonne portant leur signal (« Conflit », « Voyage Rome », « Vacances »), et une **légende** en pied : Conflit d'horaires / Voyage — cours manqué / Vacances scolaires (zone C) |
| **Construit** | `VueSemaine.tsx` est une **liste par jour**, servie telle quelle aux deux tailles d'écran. Aucun `grid-cols-7`, aucun rail horaire. Seul `legende.vacances` existe côté i18n |

⚠️ C'est le même écart que le Planning Voyages relevé le 5 septembre :
*l'intention est juste, la forme ne l'est pas*. Les signaux sont bien présents
(icônes conflit / voyage / soleil dans la liste), mais la lecture « qui est où,
à quelle heure, sur toute la semaine » que donne une grille n'existe pas.

La composition desktop **1+5** (liste + fiche côte à côte), elle, est conforme
(`ListeActivites.tsx`, grille `lg:grid-cols-[1fr_460px]`).

## 3. Trois absences franches — ✅ deux comblées (#179), ⬜ une ouverte

| Maquette | État |
|---|---|
| **Covoiturage**, à côté de « Qui dépose » (écran 7) | ⬜ **Toujours zéro occurrence** dans `src`, `messages` et les migrations |
| Périodicité **« À la séance »** (écran 9) | ✅ Ajoutée (#179) : `check` élargi à `'seance'`, clé « À la séance » |
| Type d'activité **« Soutien scolaire »** (écran 6) | ✅ Ajouté (#179) : `soutien_scolaire` en base, dans le schéma et au formulaire |

⚠️ Le covoiturage n'est pas un libellé manquant : il n'y a ni colonne, ni
champ, ni notion. C'est le plus coûteux des trois.

## 4. Trois appauvrissements — ✅ deux comblés, 🟨 un en partie (#179)

| Maquette | Construit |
|---|---|
| Chaque alerte porte **son verbe** : « Régler » (paiement), « Ajouter » (assurance expirée), « Renouveler » (certificat qui expire), « Ouvrir » (inscription) | 🟨 **En partie** (#179) : `verbeAlerte` rend **trois** verbes — `regler`, `renouveler`, `ouvrir` — au lieu de quatre, et leur **affectation est décalée d'un cran** : la maquette met « Ajouter » sur le document *expiré* et « Renouveler » sur celui qui *expire bientôt* ; le code met « Renouveler » sur l'expiré et « Ouvrir » sur l'imminent. Le progrès est réel — trois verbes plutôt qu'un « Traiter » muet — la correspondance ne l'est pas |
| Filtres actifs en **puces retirables** : « A Alexia ✕ En pause ✕ », à côté d'« Effacer » (écran 3, mobile) | ✅ Comblé (#179) : clé `filtres.retirer` = « Retirer le filtre {libelle} » |
| En-tête de résultats **nommant les filtres** : « 3 activités · Alexia · En pause » | ✅ Comblé (#179) : `ListeActivites` joint le compte et `nomsDesFiltres` — *« le compte SEUL laisse la question 3 sur combien, et pourquoi ceux-là »* |

## 5. Deux détails — ✅ un comblé (#179), ⬜ deux ouverts

- ✅ **Un seul téléphone — comblé (#179).** La migration `00058` ajoute
  `contact_nom` et `contact_telephone`, sous une contrainte que le constat
  d'origine ne demandait pas et qui vaut mieux que lui :
  `num_nonnulls(contact_nom, contact_telephone) in (0, 2)` — *un numéro sans nom
  ne dit pas qui décroche ; un nom sans numéro n'appelle personne*.
- ⬜ **Pas d'autocomplétion d'adresse au formulaire d'activité.** La maquette
  montre deux suggestions départageant « 12 route du Cap, 33470 Le Teich » de
  « 12 route du Cap-Ferret, 33950 Lège-Cap-Ferret » — c'est-à-dire exactement
  le cas où la saisie libre se trompe.
  ⚠️ **Nuance importante** : un géocodeur existe désormais sur `main`
  (`features/famille/data/geocodage.ts`, mergé en #177), mais il est branché sur
  l'adresse **du foyer** (`famille/data/actions.ts`), pas sur celle du club.
  La brique est donc là ; c'est son emploi sur ce formulaire qui manque — un
  rebranchement, pas un choix de service.
- ⬜ Le **swipe** annoté sur l'écran 1 (« ← swipe : appeler le club /
  itinéraire ») n'existe toujours pas. Les deux actions sont là, en boutons : c'est le geste qui manque,
  pas la capacité.

---

## Ce qui est tenu, et qui n'était pas facile

À ne pas re-vérifier : le **conflit de trajets** au mot près ; les **vacances
scolaires puisées à la MÊME source** que le planning Voyages (le commentaire de
`VueSemaine` le dit : *deux calendriers finiraient par se contredire*) ; le
**cours manqué pour cause de voyage** ; la
**présence sur forfait** (13/20, faites / manquées / restantes) ; les **codes
chiffrés révélés après ré-authentification** ; l'**export ICS** et sa route
d'API ; les **annulations de créneau** (tables `exceptions`) ; le **scan par
appareil photo** (`capture="environment"`) ; le **badge de compte** sur l'onglet
(`nombreAlertesUrgentes`) ; les **tags** (affichage et filtre) ; la **saison** ;
les **états vides**, y compris « reprise le 21 » pendant les vacances.

Le **temps de trajet** est tenu lui aussi depuis #177 : `domain/trajet.ts`,
`dureeEstimeeMinutes`, employé par `FicheActivite`, clé `lieu.duree`, alimenté
par les coordonnées du foyer (migration `00057`).

⚠️ Une nuance de fond, qui n'est pas un écart mais un choix à connaître : le
code assume le mot **« estimation »** — `~{n} min`, distance à vol d'oiseau et
vitesse moyenne de 22 km/h, sans appel à un service d'itinéraire — là où la
maquette écrit « 22 min depuis chez nous » sans réserve. Le tilde est dans la
clé i18n : c'est délibéré, et c'est la bonne façon de ne pas promettre une
précision qu'on n'a pas.

---

## Ordre suggéré

> ⚠️ **Cet ordre est celui du 8 septembre.** #179 a traité ses points 1 à 4. Il
> reste : l'**affectation** des verbes d'alerte (reliquat du point 2), puis les
> points 5 (semaine desktop), 6 (covoiturage) et 7 (contact, adresse).

1. **Mode de règlement** — le seul écart qui laisse une colonne vide en base.
   Peu coûteux, et plus il attend, plus les échéances déjà saisies seront
   à reprendre à la main.
2. **Verbes d'alerte contextuels** — fort usage, coût faible : l'écran Alertes
   est celui qu'on ouvre pour agir, et « Traiter » ne dit pas quoi faire.
3. **Puces de filtre retirables + en-tête nommant les filtres** — les deux vont
   ensemble : savoir ce qui filtre, et pouvoir en retirer un seul.
4. **« À la séance » et « Soutien scolaire »** — deux valeurs à ajouter.
5. **Semaine desktop en 7 colonnes** — la seule forme entièrement différente,
   donc le plus visible ; à traiter comme un lot à part.
6. **Covoiturage** — nouvelle notion (colonne, champ, affichage) : un chantier,
   pas une finition.
7. **Deuxième contact avec rôle**, puis **autocomplétion d'adresse du club** —
   le géocodeur est sur `main` depuis #177 (il sert l'adresse du foyer) : il
   s'agit de l'employer sur un second formulaire, pas de choisir un service.

*(Le point « committer le lot temps de trajet », qui figurait ici, est sans
objet : #177 l'a mergé le 9 septembre.)*
