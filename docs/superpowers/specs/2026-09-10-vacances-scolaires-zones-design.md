# Vacances scolaires — zones, source officielle et affichage

**Date** : 10 septembre 2026 · **Statut** : à relire

## Constat

`src/features/voyages/data/vacancesScolaires.ts` code **une seule zone** (C) pour
**une seule année scolaire** (2026-2027), et porte son propre avertissement :

> ⚠ À REVOIR À CHAQUE RENTRÉE : cette liste ne couvre que l'année scolaire
> 2026-2027. Passé l'été 2027, l'écran n'aura plus rien à proposer et le dira —
> mieux vaut ce silence qu'un calendrier périmé présenté comme vrai.

Le PO veut deux choses de plus : que **chaque foyer voie sa zone**, et qu'il
puisse **savoir ce qui se passe dans les autres**. Étendre le fichier à la main
triplerait une dette déjà signalée comme fragile, et ferait taire l'écran pour
tout le monde en même temps.

## Décisions

### La source est l'open data du ministère, avec un cache en base

`data.education.gouv.fr`, jeu `fr-en-calendrier-scolaire` — déjà cité en
commentaire dans le fichier actuel. Interrogé et vérifié le 10 septembre :

```
GET /api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records
    ?where=annee_scolaire="2026-2027"&select=description,start_date,end_date,zones,population
```

**Le cache n'est pas une optimisation, c'est la condition.** Le planning s'ouvre
souvent ; le faire dépendre d'un tiers à chaque rendu contredirait l'habitude du
dépôt, où un service absent dégrade sans casser (`AucunTauxProvider`,
`AucunMailProvider`). La table sert toujours ; on ne va chercher que l'année
absente. **Si l'API tombe, le dernier calendrier connu s'affiche encore** ; si
elle tombe et qu'on n'a rien, l'écran garde son message actuel. On n'invente
jamais une date.

Précédent dans le dépôt : les photos de lieux sont cachées en base avec leur
date de récupération (`photo_ref` / `photo_fetched_at`, migration 00018).

### Trois pièges, tous relevés dans la vraie réponse

Ils ne se devinent pas, et chacun produit une erreur silencieuse :

1. **Le fuseau.** `start_date` vaut `2026-12-18T23:00:00+00:00` — c'est-à-dire le
   **19 décembre à minuit, heure de Paris**. Un `.slice(0, 10)` donnerait le 18 :
   un jour de vacances effacé, et un départ planifié un jour d'école. La
   conversion passe par `Europe/Paris`. Les dates actuelles écrites en dur disent
   bien le 19 — elles servent de témoin.
2. **La duplication.** 198 enregistrements pour une seule année scolaire : il y a
   une ligne par **académie**, pas par zone. Sans déduplication sur
   (zone, libellé), la même période apparaîtrait une dizaine de fois.
3. **Le public.** Le champ `population` vaut `Élèves`, `Enseignants` ou `-`.
   Sans filtre, on annoncerait aux familles des dates de prérentrée qui ne
   concernent que les enseignants.

### Le vocabulaire des zones n'est pas « A, B, C »

Relevé dans la source, et c'est une correction au design initial : le jeu de
données distingue **onze** valeurs. Zone A (8 académies), Zone B (11), Zone C
(5 : Créteil, Montpellier, Paris, Toulouse, Versailles — ce que le commentaire
actuel annonçait déjà), la **Corse**, et sept territoires d'outre-mer
(Guadeloupe, Guyane, Martinique, Mayotte, Réunion, Polynésie, Saint-Pierre-et-
Miquelon), chacun avec son propre calendrier.

**On stocke donc la valeur telle que la source la nomme**, et le sélecteur les
propose toutes. Un sélecteur à trois choix aurait laissé sans rien des familles
dont la source porte pourtant les dates — au motif qu'elles ne rentraient pas
dans un modèle qu'on avait écrit trop vite.

L'interrupteur « voir les autres zones » n'a de sens qu'entre A, B et C : il
n'est proposé que dans ce cas.

### La zone est choisie, la déduction n'est qu'une proposition

Colonne `zone_scolaire` sur `profiles`, nullable, sans contrainte d'énumération
(le vocabulaire vient de la source, pas de nous — et il vaut mieux une valeur
inconnue affichée telle quelle qu'une migration à chaque évolution du jeu).

`deduireZone(adresse)` est une fonction **pure** : elle cherche un code postal à
cinq chiffres dans l'adresse libre du foyer (`family_members.address`, fiche
« Moi »), en tire le département, puis la zone. Elle rend `null` s'il n'y a pas
de code postal.

**Elle propose, elle n'impose pas.** L'écran de réglages affiche « Zone C,
déduite de votre adresse » tant que rien n'est enregistré ; dès que l'utilisateur
choisit, sa valeur l'emporte définitivement. Changer d'adresse ne doit pas
changer sa zone dans son dos — et un enfant scolarisé dans une autre académie
que son domicile est un cas réel, rare mais réel.

**La table département → zone se construit en deux moitiés**, et aucune ne
s'écrit de mémoire : académie → zone vient de l'API elle-même (champ `location`,
regroupé par `zones`) ; département → académie se vérifie contre le jeu
`fr-en-annuaire-education` du même portail, qui porte pour chaque établissement
son code postal et son académie — la source doit être citée dans le fichier
produit. Un test unitaire
épingle quelques ancres connues (75 → C, 69 → A, 13 → B, 2A/2B → Corse,
974 → Réunion) : elles échoueront si la table est saisie de travers.

### L'interrupteur vit dans un cookie, pas en base

Le planning est rendu côté serveur. Une préférence en `localStorage` obligerait à
révéler les bandes après l'hydratation — un clignotement à chaque ouverture. Le
thème utilise déjà un cookie lu dans le layout ; on reprend ce mécanisme. Zéro
migration, l'état survit au rechargement, et il reste par appareil, ce qui
convient à une préférence d'affichage.

Par défaut **fermé** (décision PO). Le prix est assumé et connu : ce qui est
caché n'est jamais vu.

## Modèle

```sql
create table public.vacances_scolaires (
  id             uuid primary key default gen_random_uuid(),
  annee_scolaire text not null,          -- « 2026-2027 »
  zone           text not null,          -- « Zone A », « Corse », « Réunion »… tel que la source le nomme
  libelle        text not null,          -- « Vacances de Noël »
  debut          date not null,          -- converti en date de Paris
  fin            date not null,
  recupere_le    timestamptz not null default now(),
  unique (annee_scolaire, zone, libelle)
);
```

Données publiques, mais l'écran qui les affiche est derrière la connexion :
`select` pour `authenticated`, rien pour `anon`, écriture réservée au rôle de
service (le rafraîchissement est serveur). Pas de `revoke update, delete` ici —
ce n'est pas un journal : une ligne fausse doit pouvoir être recalculée.

## Flux

1. Le planning demande les périodes d'une zone sur une fenêtre de douze mois.
2. `getVacances(zone, fenetre)` lit la table. Si une année scolaire de la fenêtre
   manque, il la récupère, la normalise, l'écrit, puis relit.
3. Une récupération qui échoue est tracée et **n'interrompt rien** : on sert ce
   que la table contient, quitte à ne rien servir.

**On ne rafraîchit que ce qui manque**, jamais ce qu'on a déjà. La règle est
volontairement bête, et sa conséquence est assumée : si le ministère corrige une
date après coup, le cache garde l'ancienne. Le remède tient en une ligne SQL —
supprimer les lignes de l'année concernée, la suivante lecture les récupère. Une
politique de fraîcheur automatique coûterait un réglage, un risque de tempête de
requêtes à chaque rentrée, et une complexité que la fréquence réelle du problème
(une correction tous les combien d'années ?) ne justifie pas.
4. Le rendu reçoit les périodes de la zone du foyer et, si l'interrupteur est
   ouvert et que la zone est A, B ou C, celles des deux autres.

Module `src/lib/services/vacances/` sur le patron de `taux-change` : `types.ts`,
`educationGouv.ts` (récupération et normalisation — les trois pièges vivent
là), `aucun.ts`, `index.ts`.

## Erreurs

| Situation | Ce que voit le lecteur |
|---|---|
| Aucune zone choisie ni déductible | Le message « calendrier absent » actuel, et un lien vers les réglages |
| API injoignable, cache garni | Le calendrier en cache, sans mention — il est juste |
| API injoignable, cache vide | Le message « calendrier absent » |
| Année non encore publiée | Idem : le silence, jamais une extrapolation |

## Vérification

- **Unitaire** : normalisation contre une **fixture capturée sur la vraie API**
  — Noël doit tomber le 19 et non le 18, 198 lignes doivent se réduire aux
  périodes distinctes, une ligne `population = Enseignants` doit disparaître ;
  `deduireZone` sur ses ancres et ses cas nuls (pas de code postal, adresse vide).
- **pgTAP** : `anon` ne lit rien de `vacances_scolaires` ; `authenticated` lit.
- **e2e** : les réglages proposent la zone déduite et enregistrent le choix ;
  l'interrupteur révèle les deux autres zones et s'en souvient après
  rechargement ; un compte sans zone voit le message et le lien.

## Ce que ce chantier remplace

`vacancesScolaires.ts`, ses dates en dur et sa constante `ZONE_SCOLAIRE = "C"`
disparaissent. Trois consommateurs à recâbler : la page planning, `PlanningFrise`,
`PlanningCalendrier`.

## Hors périmètre

La zone ne sert qu'au planning. Aucune suggestion de voyage, aucun rappel, aucune
alerte ne s'y branche dans ce chantier.
