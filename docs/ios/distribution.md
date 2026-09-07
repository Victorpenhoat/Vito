# Envoyer Vito sur TestFlight, puis sur l'App Store

La signature, les certificats et la soumission restent **tes gestes**, dans
Xcode et App Store Connect. Ce document dit dans quel ordre, et où ça coince.

## 0. Avant la première archive

Ce qui manque encore, et pourquoi ça bloque :

| Manque | Conséquence si on l'oublie |
|---|---|
| **Team ID** dans `APPLE_APP_ID` (Vercel) | le fichier `apple-app-site-association` répond 404 → les liens de connexion s'ouvrent dans Safari, pas dans l'app |
| **SMTP de production** | aucun lien de connexion ne part → le reviewer ne peut pas se connecter (il aura un mot de passe, mais toi non plus tu ne recevras rien) |
| **Gabarit du lien magique** collé dans le dashboard | le gabarit anglais par défaut pointe sur `supabase.co` → les liens profonds cessent de fonctionner |
| **PR #160 déployée en production** | la WebView charge la prod : tant qu'elle n'est pas à jour, l'app n'a ni liens externes natifs, ni géoloc native, ni abonnement masqué |

Cette dernière ligne est la plus facile à oublier : **la coque ne contient pas
l'app, elle la charge.** Une build TestFlight parfaite au-dessus d'une
production périmée montre l'ancienne app.

## 1. Créer l'app dans App Store Connect

Une seule fois. `Vito` / `com.exemple.vito` — **le bundle ID ne se change plus
après**. Le reste de la fiche est dans `app-store-checklist.md`.

## 2. Préparer la build

```sh
npm run ios:version     # aligne la version sur package.json, incrémente le build
npm run ios:sync        # recopie la coque, met à jour les plugins
npm run ios:open        # ouvre Xcode
```

`ios:version` incrémente le numéro de build à chaque fois. App Store Connect
**refuse** un envoi dont le numéro n'a pas augmenté, et il le dit après plusieurs
minutes d'upload — autant l'incrémenter avant.

## 3. Signer

Xcode → cible **App** → **Signing & Capabilities** :

- cocher **Automatically manage signing** ;
- choisir ton équipe. Xcode crée le profil et y ajoute **Associated Domains**,
  puisque le fichier d'entitlements est déjà rattaché.

Compte individuel, un seul Team ID, aucune CI qui signe : la gestion automatique
est le bon choix ici. `fastlane match` et la signature manuelle résolvent des
problèmes que tu n'as pas.

## 4. Archiver et envoyer

1. Sélectionner **Any iOS Device (arm64)** — pas un simulateur, l'archive serait
   inutilisable.
2. **Product → Archive**.
3. Dans l'Organizer : **Distribute App → App Store Connect → Upload**.
4. Laisser Xcode gérer la signature de distribution.

L'envoi est suivi d'un traitement de dix à trente minutes côté Apple avant que la
build n'apparaisse dans TestFlight.

## 5. TestFlight sur ton iPhone

1. App Store Connect → TestFlight → la build → renseigner « What to Test ».
2. Te mettre en testeur interne (ton propre compte suffit, pas de revue
   nécessaire pour les testeurs internes).
3. Installer TestFlight sur l'iPhone, accepter l'invitation, installer Vito.

### À vérifier sur l'appareil, dans cet ordre

Ce sont les points que le simulateur ne prouve pas :

- [ ] **Se connecter par lien e-mail** — le lien doit ouvrir **Vito**, pas
      Safari. C'est le test de tout le lot 4.
- [ ] **Tuer l'app et la relancer** — la session tient.
- [ ] **Se connecter par passkey** — le vrai gain de l'origine HTTPS.
- [ ] **Restaurants → Carte → « Autour de moi »** — iOS demande la position avec
      le texte français, la carte se centre.
- [ ] **Ouvrir un lien externe** (itinéraire, site d'un lieu) — il s'ouvre
      par-dessus l'app, avec un bouton « Terminé », et Vito est intact derrière.
- [ ] **Partager un voyage** — la feuille de partage iOS s'ouvre.
- [ ] **Basculer un favori** — retour haptique.
- [ ] **Emporter un voyage hors ligne**, puis mode avion — le carnet reste
      lisible.
- [ ] **Ouvrir « Abonnement »** — l'entrée a disparu du menu ; la page, si on y
      arrive par une URL, ne montre ni prix ni bouton.
- [ ] **Encoche et barre home** — rien n'est coupé, rien ne passe dessous.

## 6. Soumettre à la revue

Une fois la build validée sur ton appareil : App Store Connect → la version →
**Ajouter pour examen**. Fiche, captures, compte de test et notes au reviewer :
tout est dans `app-store-checklist.md`.

Compter quelques jours, et un ou deux allers-retours. Les motifs de rejet les
plus probables pour Vito, dans l'ordre :

1. **4.2 Minimum Functionality** — « c'est un site web emballé ». La réponse est
   dans les notes au reviewer : géoloc, hors ligne, partage système, ouverture
   des liens hors WebView.
2. **3.1.1 Achats intégrés** — traité : l'abonnement n'apparaît pas dans l'app.
3. **Compte de test inutilisable** — d'où le mot de passe, et un carnet déjà
   rempli.

## 7. Après

À chaque mise à jour du site, l'app suit **sans nouvelle build** : elle charge la
production. Une nouvelle build n'est nécessaire que pour ce qui est natif —
plugins, permissions, icônes, cible iOS.

C'est l'avantage de la stratégie retenue, et son revers : une régression
déployée sur le web est une régression dans l'app, immédiatement. La CI reste le
garde-fou.
