# Écarts entre l'application et la maquette — Activités, 8 septembre 2026

Contrairement à Voyages, Resto v2 et Cercle (cf. `ECARTS-2026-09-05.md`), ce
chantier a été construit **avec la maquette en main** : `Onglet_Activites.dc.html`
est entré dans le dépôt le 7 septembre à 20h58 (#165), et les lots #166 à #174
ont suivi le 8 septembre. Cela s'entend dans le résultat : `semaine.conflit`,
`alertes.sousTitre`, `recherchePlaceholder` et `vide.semaineVacances` reprennent
la maquette **au mot près**.

Ce document liste ce que la comparaison révèle malgré cela. Il ne corrige rien.

> ## Clôture — 9 septembre, fin de journée
>
> Sur les **onze** écarts : **neuf comblés**, **un en partie**, **un ouvert**.
> L'abandon du covoiturage a été **rouvert le 9 septembre au soir**, quelques
> minutes après cette clôture, sur demande du PO — l'arbitrage est levé, la
> fonction est livrée en #183, et son raisonnement d'origine reste lisible au
> §3. Ce document est clos ; il reste comme
> archive. Chaque écart garde son constat d'origine lisible, avec la PR qui l'a
> comblé — savoir *pourquoi* le mode de règlement avait été oublié vaut mieux,
> dans six mois, que constater qu'il est là.
>
> | | |
> |---|---|
> | ✅ **Comblés (9)** | mode de règlement · « à la séance » · « soutien scolaire » · puces de filtre retirables · en-tête nommant les filtres · second contact avec son rôle *(#179)* · autocomplétion de l'adresse du club *(#180)* · **semaine desktop en 7 colonnes** *(#181)* · **covoiturage** *(#183)* |
> | 🟨 **En partie (1)** | verbes d'alerte : trois au lieu de quatre, affectation décalée, cf. §4 |
> | ⬜ **Ouvert (1)** | **swipe** sur la liste — non tranché, cf. §5 |
>
> Hors écarts, le **temps de trajet** (§« ce qui est tenu ») est arrivé en #177.
>
> ⚠️ **Deux erreurs de décompte à moi, corrigées ici et laissées visibles.**
> ① Un bandeau antérieur annonçait « sept comblés » après #179 seulement, en
> additionnant le temps de trajet — qui n'est PAS l'un des onze. La vérité était
> **six**. ② Un « reliquat de légende » a été signalé à l'oral sur la grille
> semaine : il **n'existe pas** — les trois entrées sont là
> (`activites.semaine.legende.{conflit,voyage,vacances}`, rendues dans un
> `<ul data-testid="grille-legende">`). La sonde cherchait `activites.legende`.
> **Un décompte se vérifie contre la liste ; une absence, contre le chemin
> complet de la clé.**

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

## 2. La semaine desktop n'a pas la forme dessinée — ✅ COMBLÉ (#181)

> **Comblé le 9 septembre.** `GrilleSemaine.tsx` (145 lignes, `hidden lg:`) rend
> `grid-cols-[3rem_repeat(7,minmax(0,1fr))]` — un rail de 3rem plus **sept
> colonnes égales**, forme plus juste que le `grid-cols-7` que ce document
> laissait attendre. Le domaine porte `RAIL_DEBUT = 8`, `RAIL_FIN = 20` et
> `GRADUATIONS = [8,10,12,14,16,18,20]`, sous le commentaire *« le rail horaire
> de la maquette : 8h en haut, 20h en bas »*. Les signaux (conflit, voyage,
> vacances) sont portés par les en-têtes de colonne, et la **légende en trois
> entrées** est rendue. Le constat d'origine suit.

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

## 3. Trois absences franches — ✅ toutes comblées (#179, #183)

> ↩️ **Arbitrage LEVÉ le 9 septembre au soir, et le covoiturage est livré
> (#183).** Le paragraphe ci-dessous demandait qu'on ne rouvre pas sans revenir
> sur la décision : c'est fait, explicitement, par le PO, une heure après
> l'avoir prise. La forme retenue ménage l'objection de fond — Vito ne
> **négocie** aucun covoiturage, il note seulement que la dépose se fait ainsi :
> `depose_covoiturage` est un booléen sur le créneau, exclusif de `depose_par`
> par un `check`, qui donne au « qui dépose » sa troisième réponse à côté des
> deux parents. Aucun échange, aucun tiers, aucune coordination.
>
> Le constat d'origine, et la raison qui a valu l'abandon, suivent — ils
> expliquent mieux que ce bandeau pourquoi cette notion a coûté plus que les
> dix autres.

> ⛔ **Le covoiturage était ABANDONNÉ — arbitrage PO du 9 septembre**, et non une
> dette qui traîne. C'était le seul des onze écarts à demander une **notion
> nouvelle** (colonne, champ, affichage), là où tous les autres n'étaient que du
> câblage manquant sur des données déjà présentes. Et c'est le seul dont
> l'abandon se défend sur le fond : la maquette le place à côté de « Qui
> dépose », mais un covoiturage se négocie entre parents — pas dans un carnet
> familial. **Ne pas le rouvrir sans revenir sur cet arbitrage.**

| Maquette | État |
|---|---|
| **Covoiturage**, à côté de « Qui dépose » (écran 7) | ✅ **Comblé** (#183) après un abandon levé le soir même — `depose_covoiturage` sur le créneau |
| Périodicité **« À la séance »** (écran 9) | ✅ Ajoutée (#179) : `check` élargi à `'seance'`, clé « À la séance » |
| Type d'activité **« Soutien scolaire »** (écran 6) | ✅ Ajouté (#179) : `soutien_scolaire` en base, dans le schéma et au formulaire |

⚠️ Le covoiturage n'était pas un libellé manquant : il n'y avait ni colonne, ni
champ, ni notion. C'était le plus coûteux des trois — et il a bien coûté une
migration (`00059`), un domaine, une colonne de grille et ses tests.

## 4. Trois appauvrissements — ✅ deux comblés, 🟨 un en partie (#179)

| Maquette | Construit |
|---|---|
| Chaque alerte porte **son verbe** : « Régler » (paiement), « Ajouter » (assurance expirée), « Renouveler » (certificat qui expire), « Ouvrir » (inscription) | 🟨 **En partie** (#179) : `verbeAlerte` rend **trois** verbes — `regler`, `renouveler`, `ouvrir` — au lieu de quatre, et leur **affectation est décalée d'un cran** : la maquette met « Ajouter » sur le document *expiré* et « Renouveler » sur celui qui *expire bientôt* ; le code met « Renouveler » sur l'expiré et « Ouvrir » sur l'imminent. Le progrès est réel — trois verbes plutôt qu'un « Traiter » muet — la correspondance ne l'est pas |
| Filtres actifs en **puces retirables** : « A Alexia ✕ En pause ✕ », à côté d'« Effacer » (écran 3, mobile) | ✅ Comblé (#179) : clé `filtres.retirer` = « Retirer le filtre {libelle} » |
| En-tête de résultats **nommant les filtres** : « 3 activités · Alexia · En pause » | ✅ Comblé (#179) : `ListeActivites` joint le compte et `nomsDesFiltres` — *« le compte SEUL laisse la question 3 sur combien, et pourquoi ceux-là »* |

## 5. Deux détails — ✅ deux comblés (#179, #180), ⬜ un OUVERT et NON TRANCHÉ

- ✅ **Un seul téléphone — comblé (#179).** La migration `00058` ajoute
  `contact_nom` et `contact_telephone`, sous une contrainte que le constat
  d'origine ne demandait pas et qui vaut mieux que lui :
  `num_nonnulls(contact_nom, contact_telephone) in (0, 2)` — *un numéro sans nom
  ne dit pas qui décroche ; un nom sans numéro n'appelle personne*.
- ✅ **Autocomplétion d'adresse du formulaire d'activité — comblée (#180).**
  La maquette montrait deux suggestions départageant « 12 route du Cap,
  33470 Le Teich » de « 12 route du Cap-Ferret, 33950 Lège-Cap-Ferret » —
  c'est-à-dire exactement le cas où la saisie libre se trompe. `ChampAdresseClub.tsx`
  (100 lignes) s'appuie sur le géocodeur arrivé en #177 pour le foyer : le
  rebranchement annoncé ici a bien été fait, et l'adresse du club est désormais
  **située**, pas seulement saisie.
- ⬜ Le **swipe** annoté sur l'écran 1 (« ← swipe : appeler le club /
  itinéraire ») n'existe toujours pas.
  ⚠️ **Seul écart NON TRANCHÉ à la clôture** : ni fait, ni abandonné. À la
  différence du covoiturage, il ne demande aucune donnée nouvelle — les deux
  actions existent déjà en boutons (`appeler`, `itineraire`). C'est un **geste**
  qui manque, pas une fonction : le coût est en interaction tactile, pas en
  modèle. À trancher pour de bon plutôt qu'à laisser dormir. Les deux actions sont là, en boutons : c'est le geste qui manque,
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

> ⚠️ **Cet ordre est celui du 8 septembre, et il est SOLDÉ.** #179 a traité ses
> points 1 à 4, #180 le point 7, #181 le point 5, #183 le point 6
> (covoiturage, d'abord abandonné puis rouvert le soir même).
> Il ne reste, hors de cette liste, que deux choses :
> l'**affectation** des verbes d'alerte (§4) et le **swipe** (§5).

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
