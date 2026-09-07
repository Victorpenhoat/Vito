# Publier Vito sur l'App Store — check-list

Tout ce qui suit se fait dans **App Store Connect** et **Xcode**, donc par toi.
Ce document dit quoi remplir, avec quoi, et pourquoi.

---

## L'abonnement, et la règle 3.1.1

Vito vend un abonnement qui débloque des fonctions de l'app. La règle **3.1.1**
réserve cela aux **achats intégrés** ; un lien vers un paiement extérieur est un
motif de rejet classique.

**Décision du PO (2026-09-06) : l'abonnement est masqué dans la coque.** On
s'abonne sur le web, l'app en tient compte — c'est ce que font Netflix ou
Spotify. Les achats intégrés restent hors périmètre.

Concrètement, quand l'app tourne en natif :

- la page `/abonnement` ne montre **ni prix ni bouton** — seulement l'état du
  compte (Gratuit ou Premium), qu'un abonné doit pouvoir vérifier ;
- l'entrée « Abonnement » disparaît de la navigation ;
- la limite de voyages du plan gratuit se dit, mais ne mène plus nulle part.

La détection se fait **côté serveur**, au User-Agent que la coque ajoute
(`appendUserAgent: "VitoiOS"`) : la page ne rend pas ce qu'elle doit cacher,
plutôt que de le rendre puis de l'effacer sous les yeux du reviewer. Trois tests
e2e le vérifient, dont un qui s'assure qu'aucun « € » ne subsiste dans la page.

Si un jour les achats intégrés arrivent, c'est ce même point de bascule qu'il
faudra rouvrir.

## Fiche App Store Connect

| Champ | Valeur | État |
|---|---|---|
| Nom (30 car. max) | **Vito** | ✅ arrêté |
| Sous-titre (30 car. max) | « Votre carnet de sorties » (25) | proposition |
| Bundle ID | `com.exemple.vito` | ⏳ **provisoire** — attend le domaine (OVH) |
| Catégorie principale | Voyage | proposition |
| Catégorie secondaire | Style de vie | proposition |
| Classification | 4+ | — |
| iOS minimum | 16.0 | ✅ arrêté |
| Langue principale | Français | — |
| URL de confidentialité | `https://<domaine>/fr/confidentialite` | ✅ page en ligne |
| URL de support | *à créer* (une page ou une adresse e-mail suffit) | ⏳ |
| Copyright | `2026 <ton nom>` | ⏳ |

Le compte est **individuel** : c'est ton nom qui s'affiche comme éditeur, pas une
raison sociale. Une conversion en compte organisation reste possible plus tard et
conserve le bundle ID.

### Description (proposition, à relire)

> Vito est le carnet de vos sorties et de vos voyages.
>
> Les restaurants que vous voulez tester, ceux que vous avez aimés, les hôtels où
> vous êtes bien tombé, les bouteilles de votre cave, les voyages que vous
> préparez et ceux que vous racontez : tout tient au même endroit, et vous
> retrouvez chaque adresse sur une carte.
>
> • Vos adresses sur une carte, et ce qui est autour de vous
> • Vos voyages : programme, réservations, dépenses partagées, billets
> • Votre cave, vos dégustations, vos envies
> • Vos proches, leurs documents, à l'abri et chiffrés
> • Le carnet d'un voyage, emporté hors ligne
>
> Vito ne suit personne : ni publicité, ni profil revendu, ni mesure d'audience.

### Mots-clés (100 caractères, séparés par des virgules, sans espaces)

```
carnet,restaurant,hotel,voyage,cave,vin,favoris,adresses,carte,depenses,famille
```

Ne pas répéter le nom de l'app ni la catégorie : Apple les indexe déjà.

---

## Captures d'écran

Obligatoires pour **deux tailles** seulement (les autres sont dérivées) :

| Appareil | Résolution | Nombre |
|---|---|---|
| iPhone 6,9" (17 Pro Max) | 1320 × 2868 | 3 à 10 |
| iPhone 6,5" (11 Pro Max / XS Max) | 1242 × 2688 | 3 à 10 |

Se prennent au simulateur :

```sh
xcrun simctl boot "iPhone 17 Pro Max"
xcrun simctl io booted screenshot capture.png
```

Ordre proposé — les trois premières sont celles qu'on voit dans les résultats de
recherche : **la carte avec ses adresses**, **un voyage et son programme**, **les
dépenses partagées**, puis la cave, puis le mode hors ligne.

---

## Compte de test (obligatoire : l'app exige une connexion)

Sans compte, le reviewer voit un écran de connexion et rejette pour
« impossible d'évaluer ». À préparer sur la **production** :

- une adresse dédiée, jamais la tienne ;
- **un mot de passe** — surtout pas un accès par lien magique : le reviewer n'a
  pas accès à la boîte mail. L'app sait se connecter par mot de passe
  (`Utiliser un mot de passe` sur l'écran de connexion), c'est cette voie qu'il
  faut lui donner ;
- un carnet **déjà rempli** : quelques restaurants, un hôtel, un voyage avec son
  programme et deux ou trois dépenses. Un carnet vide donne l'impression d'une
  app vide.

À saisir dans App Store Connect → *Informations pour la vérification*.

---

## Notes pour le reviewer (règle 4.2, « Minimum Functionality »)

À coller telles quelles, en anglais, dans *Notes*. L'enjeu : montrer que l'app
fait des choses qu'un site ne fait pas.

> Vito is a personal notebook for restaurants, hotels, wines and trips.
>
> The app is not a wrapper around a website. It uses the device in ways a web
> page cannot:
>
> • **Location** — "Around me" uses Core Location to centre the map on the user
>   and find saved places nearby. Location is used at that moment only; it is
>   never stored or transmitted.
> • **Offline** — a trip can be taken offline: its programme, bookings and
>   documents remain readable with no network, which matters abroad.
> • **System integration** — external links (Maps, a restaurant's own site) open
>   in Safari View Controller rather than inside the app; sharing uses the
>   system share sheet; sign-in links open directly in the app through Universal
>   Links; haptic feedback confirms marking a place as a favourite.
> • **Encrypted documents** — identity documents of family members are encrypted
>   before storage and decrypted only for their owner.
>
> Test account: <adresse> / <mot de passe>. The account already contains
> restaurants, a hotel, a trip with its programme and shared expenses.
>
> To see location in action: open Restaurants → Map → "Autour de moi".
> To see offline mode: open a trip → "Emporter hors ligne", then enable
> Airplane Mode.

---

## Avant d'envoyer la première build

- [x] L'abonnement est masqué dans la coque (voir tout en haut)
- [ ] Bundle ID définitif, dérivé du domaine acheté, puis `CAP_APP_ID=… npm run ios:regen`
- [ ] `APPLE_APP_ID` posé dans Vercel, et
      `/.well-known/apple-app-site-association` répond 200 en JSON
- [ ] Équipe choisie dans Xcode (Signing & Capabilities), Associated Domains
      présent
- [ ] Version alignée : `package.json`, `CFBundleShortVersionString`,
      `CFBundleVersion`
- [ ] Le gabarit du lien magique est collé dans le dashboard Supabase (sinon les
      liens profonds cessent de fonctionner — voir `authentification.md`)
- [ ] SMTP de production configuré : sans lui, aucun lien de connexion ne part
- [ ] Compte de test créé et rempli
- [ ] Captures prises aux deux tailles
- [ ] `PrivacyInfo.xcprivacy` présent dans le bundle (vérifié à chaque build :
      `ls App.app/PrivacyInfo.xcprivacy`)
