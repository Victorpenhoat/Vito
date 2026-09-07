# Se connecter dans l'app iOS

## Ce qui rend l'affaire possible (et qui existait déjà)

Le gabarit du lien magique pointe **directement sur notre domaine** :

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=email">
```

C'est décisif. **iOS ne suit pas les Universal Links à travers une
redirection** : si le mail pointait d'abord sur `…supabase.co/auth/v1/verify`,
le lien s'ouvrirait dans Safari, la session s'installerait dans le navigateur, et
l'app resterait déconnectée juste à côté. Ici, le premier saut est déjà chez
nous : iOS reconnaît le domaine et remet l'URL à Vito.

Ce gabarit vit dans `supabase/config.toml` + `supabase/templates/magic_link.html`,
qui ne s'appliquent **qu'en local**. En production il doit être collé dans le
dashboard (Authentication → Emails → Magic Link). Sans lui, le gabarit anglais
par défaut de Supabase pointe sur `supabase.co`, et les liens profonds ne
fonctionnent plus.

## Les trois pièces

1. **`/.well-known/apple-app-site-association`** — route Next qui déclare les
   chemins appartenant à l'app. Servie seulement si `APPLE_APP_ID` a la **forme
   complète** « `<App ID Prefix>.<bundle ID>` », par exemple
   `Q7UGNF4Q22.com.badakan.vito` ; sinon 404.

   Le préfixe seul (`Q7UGNF4Q22`) produirait un fichier syntaxiquement valide et
   parfaitement inutile — l'erreur a été commise, la route la refuse désormais.
   iOS met en cache ce qu'il télécharge : un fichier à moitié juste se paie en
   heures d'attente.
2. **`App.entitlements`** — `applinks:vito-theta.vercel.app`. Écrit par
   `npm run ios:personnaliser`, donc réappliqué après un `ios:regen`.
3. **`LiensProfonds`** — écoute `appUrlOpen` et joue le chemin reçu dans la
   WebView. Navigation complète et non cliente : le retour du lien magique passe
   par une route serveur qui **pose des cookies**, qu'une navigation React ne
   verrait pas s'installer.

Le chemin reçu est vérifié : une URL d'un autre domaine est ignorée, sans quoi
n'importe qui pourrait, par un lien forgé, faire naviguer l'app où il veut.

## Les redirect URLs à saisir dans Supabase

**Authentication → URL Configuration.** À faire par toi, je ne touche pas au
dashboard :

| Champ | Valeur |
|---|---|
| Site URL | `https://vito-theta.vercel.app` |
| Redirect URLs | `https://vito-theta.vercel.app/**` |
| Redirect URLs (dév) | `http://localhost:3000/**` |

**C'est tout — il n'y a aucune URL spécifique à l'app.** Pas de `vito://`, pas
de `capacitor://localhost`. La coque charge la même origine que le web : elle
n'a donc rien de plus à autoriser. C'est le bénéfice le plus concret de la
stratégie retenue.

## Persistance de la session : rien à ajouter

Le client navigateur est `@supabase/ssr` `createBrowserClient`, qui stocke la
session dans des **cookies** (`document.cookie`, `path=/`, `SameSite=Lax`,
`max-age` de 400 jours) — vérifié dans `node_modules/@supabase/ssr`. WKWebView
les conserve dans son magasin persistant, qui survit à la fermeture de l'app.

**`@capacitor/preferences` n'est donc pas nécessaire**, et l'ajouter
introduirait un second endroit où vit la session — c'est-à-dire un endroit où
elle peut diverger.

À savoir : ce magasin est **propre à l'app**, il n'est pas partagé avec Safari.
Se connecter dans Safari ne connecte pas l'app. C'est exactement pourquoi les
liens profonds comptent.

## Ce qui reste à faire côté Xcode (toi)

1. Ouvrir le projet (`npm run ios:open`), onglet **Signing & Capabilities**,
   choisir ton équipe. La capacité **Associated Domains** apparaît d'elle-même :
   le fichier d'entitlements est déjà rattaché.
2. Poser `APPLE_APP_ID` dans Vercel (`<TeamID>.<bundleId>`), pour les trois
   environnements.
3. Vérifier que le fichier sort bien :
   `curl -s https://vito-theta.vercel.app/.well-known/apple-app-site-association`
   doit rendre du JSON, en 200, sans redirection.

## Vérifier sur l'appareil

1. Se déconnecter dans l'app, demander un lien par e-mail.
2. Ouvrir le mail **sur l'iPhone** : le lien doit ouvrir **Vito**, pas Safari.
3. Tuer l'app, la relancer : la session doit tenir.

Si le lien s'obstine à ouvrir Safari : iOS a mis le fichier en cache. Désinstaller
l'app, la réinstaller, et vérifier que `APPLE_APP_ID` correspond bien au couple
équipe + bundle ID **de la build installée**.
