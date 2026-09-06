# Clés externes dans la WebView

Le brief prévoyait un chantier : « la clé Places/Mapbox est restreinte par
referrer HTTP, et le referrer change en WebView native ». **Le code ne pose pas
ce problème**, et c'est la meilleure nouvelle de ce lot.

## La carte n'a pas de clé

Leaflet + tuiles **OpenStreetMap** (`{s}.tile.openstreetmap.org`), sans clé, sans
compte, sans referrer à autoriser. Rien à faire pour l'app.

Vérifié dans le simulateur, sur WebKit iOS : tuiles, marqueurs par statut,
contrôles de zoom, « Autour de moi ». C'est le même moteur de rendu que la
WebView de la coque — Safari et WKWebView ne diffèrent pas là-dessus.

Une réserve, pour plus tard : la politique d'usage des tuiles OSM vise un trafic
modeste. À l'échelle d'un carnet personnel, c'est prévu ; si Vito s'ouvrait
largement, il faudrait un fournisseur de tuiles dédié — c'est un changement
d'URL dans `CategoryMap`, pas une refonte.

## La clé Places est côté serveur, et y reste

`GOOGLE_PLACES_API_KEY` n'existe que sur le serveur : la recherche passe par une
action serveur, et les photos par un proxy same-origin (`/api/places/photo`, qui
ne renvoie jamais la clé, seulement une référence interne). Depuis la WebView,
ce sont des requêtes vers **notre propre origine** — exactement comme depuis un
navigateur.

**Aucune clé restreinte par bundle ID n'est donc nécessaire**, et il n'y a rien à
autoriser côté Google. C'est la conséquence directe de la stratégie retenue : la
coque charge le site, elle ne le remplace pas.

Si un jour une clé devait passer côté client (carte payante, SDK natif), la
règle serait : **une clé distincte de celle du web, restreinte par bundle ID
iOS** — jamais la même élargie, sinon une fuite côté app compromettrait aussi le
web.

## Deux pièges rencontrés en vérifiant

**`server.url` doit être une ORIGINE, jamais un chemin profond.** Pointé sur
`http://localhost:3000/api/auth/confirm?…`, Capacitor considère tout ce qui sort
de ce chemin comme extérieur à l'app : la redirection qui suit part dans Safari,
et l'app reste derrière. Avec l'origine seule, les redirections du serveur
(`/` → `/fr`, puis le retour du lien magique) restent dans la WebView — vérifié.

**iOS n'oppose pas ATS à `http://localhost`.** La coque charge le serveur local
sans exception dans `Info.plist` : `CAP_SERVER_URL=http://localhost:3000 npm run
ios:sync` suffit pour développer contre sa machine, et rien de tout cela ne part
en production.
