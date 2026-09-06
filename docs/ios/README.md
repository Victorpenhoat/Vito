# Vito sur iOS

L'app iOS est une **coque Capacitor autour de l'origine HTTPS de production**.
Elle n'embarque pas le site : elle le charge. Ce qu'elle apporte est natif —
géolocalisation, partage, ouverture des liens hors WebView, carnet hors ligne.

## Pourquoi pas un bundle statique embarqué

Trois raisons mesurées dans le code, pas des préférences :

- **les documents chiffrés** (Cercle, vouchers, tickets) sont déchiffrés par une
  route serveur avec une clé qui ne doit jamais atteindre le client. En statique,
  il faudrait la livrer — c'est-à-dire ne plus chiffrer ;
- **les passkeys** : WebAuthn est lié à l'origine chargée. Sous
  `capacitor://localhost`, `signInWithPasskey()` ne fonctionne pas ;
- **l'ampleur** : 31 des 39 pages sont des composants serveur, 102 actions
  serveur, 58 fichiers ouvrant un client Supabase serveur, plus le middleware
  d'internationalisation. Et la clé Google Places, aujourd'hui serveur, devrait
  passer côté client — donc l'export statique ne supprimerait même pas le serveur.

## Prérequis

- macOS avec **Xcode** (testé avec Xcode 26.6)
- Node (voir `.nvmrc` si présent) et les dépendances du repo (`npm ci`)
- **Pas de CocoaPods** : le projet utilise Swift Package Manager
  (`cap add ios --packagemanager SPM`). Rien à installer côté Ruby.

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run ios:sync` | recopie la coque et met à jour les plugins natifs |
| `npm run ios:open` | ouvre le projet dans Xcode |
| `npm run ios:assets` | régénère icônes et écrans de lancement depuis `assets/` |
| `npm run ios:regen` | **efface et régénère** `ios/` (au changement de bundle ID) |

`ios:sync` ne construit pas le site : il est déployé par Vercel, et la WebView
le charge. C'est la différence avec un projet Capacitor classique.

## Icônes et écran de lancement

Source unique : `assets/icon-only.png`, `assets/splash.png`,
`assets/splash-dark.png`, produits par `node scripts/generer-icones.mjs` à partir
des tokens du thème (papier `#FBF9F3`, encre `#211E1A`, or `#E9B949`). Le même
script régénère `public/icon-192.png` et `public/icon-512.png` du manifeste PWA,
qui étaient jusqu'ici des images de **1×1 pixel**.

## Construire et lancer

```sh
npm run ios:sync
npm run ios:open        # puis ⌘R dans Xcode, cible « iPhone 17 » ou un appareil
```

En ligne de commande, sans signature (simulateur) :

```sh
cd ios/App
xcodebuild -scheme App -sdk iphonesimulator -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO build
```

## Ce qui reste ouvert

- **Bundle ID et nom** : `com.badakan.vito` / « Vito » sont **provisoires**
  (`CAP_APP_ID`, `CAP_APP_NAME`). Le bundle ID devient définitif à la création de
  l'app dans App Store Connect — pas avant.
- **Cible iOS minimale** : 15.0 (valeur par défaut de Capacitor). Recommandation :
  16.0, pour WebAuthn et les safe areas.
- Signature, certificats, TestFlight et soumission : lots ultérieurs, et actions
  manuelles dans Xcode / App Store Connect.
