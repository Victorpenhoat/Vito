# Boîte de réception — cadrage

Dernier report de la refonte Resto v2. Rédigé le 2026-09-04, après merge de #144.

## Le problème

Aujourd'hui, quand un proche vous conseille un restaurant, **c'est vous qui
saisissez tout** : vous ajoutez l'adresse, puis vous renseignez à la main
« recommandé par Camille » (`liste_items.origine_type = 'reco'`). Celui qui
recommande n'a aucun moyen de vous envoyer quoi que ce soit depuis Vito.

La boîte de réception renverse ce sens : un proche vous envoie une adresse,
elle vous attend, vous l'acceptez ou vous la déclinez.

## Décisions du PO (2026-09-04)

1. **Contenu** : uniquement des **adresses recommandées** (restaurant, hôtel,
   vin). Les réponses de la conciergerie restent où elles sont, les invitations
   de voyage gardent leur écran — la boîte ne devient pas un fourre-tout.
2. **Expéditeurs** : **mon Cercle seulement**. Rien à modérer, aucun
   indésirable possible par construction.
3. **Traitement** : accepter fait entrer l'adresse au carnet en « À tester »,
   avec l'origine « recommandé par \<expéditeur\> » déjà remplie. Refuser retire
   l'entrée de la boîte **sans notifier l'expéditeur** — on ne froisse personne.
4. **Emplacement** : un **écran global**, toutes catégories confondues, avec un
   compteur dans le menu. Le design d'origine la plaçait dans Restaurants, mais
   Hôtels et la Cave existent depuis : une boîte par onglet se périmerait vite.

## Ce qui manque en base, et qu'il faut faire d'abord

**Un membre du Cercle n'est relié à aucun compte.** `family_members` ne porte
pas de `profile_id`, et `profiles` ne porte pas de `family_member_id` : les deux
tables s'ignorent. L'invitation de O-C sait viser un rôle `'cercle'`
(`invitations.role_vise`), mais **rien ne rattache le compte créé au proche qui
l'a reçue**.

Conséquence directe : la décision « mon Cercle seulement » est **inapplicable en
l'état** — on ne peut pas savoir que le compte qui envoie est bien Camille, ni à
quel compte envoyer quand je choisis Camille dans mon Cercle.

C'est donc le premier lot, et il vaut par lui-même : c'est aussi ce qui manque
pour que « un proche voit sa propre fiche » (promesse du lot O-F) fonctionne
vraiment.

### Lot 1 — le chaînon manquant

- `family_members.profile_id uuid references profiles(id) on delete set null`,
  unique par utilisateur (`unique (user_id, profile_id) where profile_id is not null`) :
  deux proches ne peuvent pas pointer le même compte.
- `on delete set null`, jamais cascade : un compte supprimé ne doit pas effacer
  la fiche du proche — même principe qu'aux participants de voyage.
- `consommer_invitation` remplit ce lien quand `role_vise = 'cercle'` :
  l'invitation sait déjà qui l'a émise, il lui manque de savoir **pour quel
  proche** — d'où une colonne `invitations.family_member_id` renseignée à
  l'émission.
- Écran Cercle : sur une fiche de proche, « Inviter » crée l'invitation liée, et
  la fiche affiche ensuite « compte rattaché ».

## Modèle proposé pour la boîte

### Lot 2 — envoyer et recevoir

```
recommandations
  id                uuid pk
  de_profile_id     uuid not null → profiles      (l'expéditeur)
  vers_profile_id   uuid not null → profiles      (le destinataire)
  categorie         text check ('resto','hotel','vin')
  -- Adresse : le place_id du fournisseur suffit, l'établissement sera créé
  -- (ou retrouvé) à l'acceptation par `ajouterAuCarnet` — la mécanique du lot H6.
  place_id          text
  -- Vin : pas de place_id, on porte le libellé.
  vin_nom           text
  vin_domaine       text
  vin_millesime     smallint
  libelle           text not null    -- instantané pour l'affichage, même si la source disparaît
  mot               text             -- « pour ton anniversaire, le poisson est parfait »
  statut            text not null default 'en_attente' check ('en_attente','acceptee','refusee')
  traitee_le        timestamptz
  created_at        timestamptz not null default now()
  check (num_nonnulls(place_id, vin_nom) = 1)   -- une recommandation vise une chose
```

**RLS.** Le destinataire lit et met à jour les siennes (`vers_profile_id =
auth.uid()`), l'expéditeur lit les siennes en lecture seule. **L'insertion passe
par une RPC `security definer`** : elle seule vérifie que le destinataire est
bien un proche de l'expéditeur **avec un compte rattaché**, et refuse tout le
reste. Aucune policy d'insertion directe — sans quoi n'importe quel compte
pourrait écrire une ligne vers n'importe qui.

**Anti-énumération.** La RPC ne dit jamais si un compte existe : elle prend un
`family_member_id` (donc quelqu'un que j'ai déjà dans mon Cercle), pas une
adresse e-mail. On ne découvre personne avec.

### Flux

- **Envoyer** : depuis une fiche (resto, hôtel, vin) → « Recommander à… » →
  liste des proches ayant un compte rattaché → un mot facultatif.
- **Recevoir** : écran `/reception`, compteur dans le menu, une carte par
  recommandation (qui, quoi, le mot, la catégorie).
- **Accepter** : `ajouterAuCarnet` (restos/hôtels) ou création du vin dans la
  Cave, statut « À tester », `origine_type = 'reco'` et
  `origine_family_member_id` = l'expéditeur vu depuis mon Cercle **quand il y
  est** ; sinon `origine_qui` = son nom. La ligne passe à `acceptee`.
- **Refuser** : la ligne passe à `refusee` et quitte la boîte. **L'expéditeur ne
  voit que « envoyée »** — décision du PO : il ne saura pas qu'on a décliné.

### Lot 3 — le compteur et les états

Compteur dans le menu (nombre en attente), état vide (« rien à traiter »),
historique des recommandations envoyées sur ma propre fiche de proche, et
purge : une recommandation traitée depuis plus de 90 jours disparaît.

## Hors périmètre, explicitement

- Les réponses de la conciergerie et les invitations de voyage **ne bougent
  pas** : elles gardent leurs écrans.
- Aucune notification par e-mail ou push. La boîte se consulte.
- Aucun envoi à quelqu'un hors de mon Cercle, donc **aucun blocage ni
  modération à construire** — c'est le bénéfice de la décision 2.

## Ce qui reste à trancher

1. **Les vins** : les inclure dès le lot 2, ou commencer par les adresses
   (restos/hôtels) et ajouter les vins ensuite ? La mécanique d'acceptation
   diffère (`ajouterAuCarnet` d'un côté, création d'un vin de l'autre).
2. **La réciprocité** : Camille peut m'envoyer une adresse si je suis dans SON
   Cercle avec un compte rattaché. Si je ne suis pas dans son Cercle, elle ne
   peut rien m'envoyer, même si elle est dans le mien. C'est cohérent et sans
   surprise, mais il faut le savoir : **le lien n'est pas symétrique**.
3. **Le design** : l'écran de la boîte n'existe nulle part (le design Resto v2
   n'est pas dans le dépôt). À défaut, je le composerai avec les conventions
   maison — cartes, états vides annoncés, compteur discret.

## Vérification prévue

Domaine pur d'abord (règles d'acceptation, dédoublonnage d'une adresse déjà au
carnet, tri de la boîte), puis pgTAP sur la RLS et la RPC (un compte étranger ne
peut rien écrire, le destinataire ne voit que les siennes, anon ne voit rien),
puis e2e à deux comptes : Victor recommande à Camille, Camille accepte, l'adresse
est dans son carnet avec la bonne origine.
