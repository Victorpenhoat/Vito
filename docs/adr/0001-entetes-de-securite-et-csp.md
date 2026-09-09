# 0001 — En-têtes de sécurité et CSP

**Date** : 9 septembre 2026 · **Statut** : accepté · **CSP en vigueur depuis le
10 septembre 2026** (voir « Passage en vigueur »)

## Constat

L'audit du 9 septembre a lu les en-têtes réels de la production :

```
curl -I https://vito-theta.vercel.app/fr
strict-transport-security: max-age=63072000; includeSubDomains; preload
```

Un seul en-tête, et il vient de Vercel, pas de nous. Ni CSP, ni `nosniff`, ni
`Referrer-Policy`, ni `Permissions-Policy`, ni COOP/CORP. `next.config.ts`
faisait dix-huit lignes et ne déclarait aucun `headers()`.

## Décision

**Deux natures d'en-têtes, deux endroits.** Ceux qui ne dépendent pas de la
requête sont posés par `next.config.ts` sur `/:chemin*` — donc aussi sur `/api`
et les fichiers, que le proxy ne voit pas (son matcher les exclut). Un en-tête
de sécurité troué n'en est pas un. La CSP, elle, porte une nonce tirée par
requête : elle ne peut vivre que dans `src/proxy.ts`.

**La nonce passe par la REQUÊTE, pas seulement par la réponse.** Next relit
l'en-tête CSP de la requête pour poser la nonce sur ses propres scripts —
`app-render.js` accepte `content-security-policy` comme
`content-security-policy-report-only`. `next-intl` recopie les en-têtes de la
requête (`new Headers(request.headers)`) dans son `NextResponse.rewrite`, donc
la nonce traverse jusqu'au rendu. Sans ce passage, le Report-Only mesurerait
une politique que personne n'appliquerait : on rapporterait des violations
fausses et on masquerait les vraies. Un test e2e lit le **HTML servi** pour le
prouver — pas le DOM, car le navigateur vide l'attribut `nonce` après analyse.

**Seuls les GET sont reconstruits.** Rebâtir la requête d'une action serveur
(POST) risquerait son corps pour une nonce qui ne sert à rien dans une réponse
RSC.

**Report-Only d'abord.** Poser une CSP stricte d'emblée sur une app qui rend
Leaflet, un service worker et quatre locales, c'est casser en production ce
qu'on n'a pas mesuré. `/api/csp-report` collecte, `log.warn("csp_violation")`
trace, et le passage en vigueur attend un parcours complet muet.

## Assouplissements assumés

`style-src-attr 'unsafe-inline'` : Leaflet positionne tuiles et marqueurs en
écrivant `element.style`, et React rend `style={{…}}` en attribut. Sans cela la
carte ne s'affiche pas. Une injection de style n'exécute pas de code, et
`script-src` ne cède rien — un test unitaire vérifie que `script-src` ne
contient jamais `'unsafe-inline'`.

`img-src` autorise `https://*.tile.openstreetmap.org`, seule ressource visuelle
chargée hors de notre origine : les photos de lieux passent par notre proxy,
donc par `'self'`.

## Mesure

Suite complète : **176 e2e au vert**, dont 6 nouveaux sur les en-têtes.
Sur les parcours carte, restaurants et vins, une seule espèce de violation
remonte — `script-src` bloquant `eval`, **76 fois**. Elle vient de
l'instrumentation Playwright, pas de l'app : les 89 chunks client ne
contiennent ni `eval(` ni `new Function(`, et React n'évalue pas en production.

## Passage en vigueur (10 septembre 2026)

L'en-tête est désormais `Content-Security-Policy`. `report-uri` reste posé : une
violation renseigne autant quand elle bloque que quand elle rapportait.

**Ce qu'il fallait vérifier n'était pas la liste des violations, mais la nonce.**
`script-src` porte `'strict-dynamic'`, qui fait **ignorer `'self'`** : seuls les
scripts portant la nonce se chargent. Une page rendue **statiquement** — bâtie
au build, sans requête, donc sans nonce — n'exécute alors plus une ligne. Elle
répond 200 et ne fait rien : la panne la plus silencieuse qui soit.

Le build le dit route par route (`○ Static` / `ƒ Dynamic`). Les 44 routes de
l'app sont dynamiques, et le HTML servi le confirme : `/fr` compte 15 balises
`<script>` et 17 `nonce=`, aucune balise sans nonce sur `/fr`, `/en`,
`/fr/login` ni `/fr/confidentialite`. Un test e2e tient cet invariant par
lecture du HTML servi — c'est le seul endroit où le basculement se verrait,
puisque rien dans le typage ne le signale.

**L'exception connue : `/_not-found`.** C'est la seule route prérendue en
statique, et c'est la page 404 par défaut de Next — dix balises `<script>`,
aucune nonce, plus un `<style>` inline. Sous la politique en vigueur, tout y est
bloqué : le 404 s'affiche en texte anglais non stylé, et chaque visite émet une
dizaine de rapports. Rien de fonctionnel ne s'y perd (cette page n'a aucune
interaction), mais le bruit peut noyer un vrai signal.

La sortie serait de servir un 404 **dynamique** — un `not-found.tsx` sous
`[locale]`, qui hériterait de la nonce et, au passage, parlerait les quatre
langues. Ce n'est pas fait : l'app n'a jamais eu de 404 à elle, et en écrire une
est une décision de produit, pas une conséquence de la CSP.

## Ce qui reste

Un parcours cliqué sur un **vrai navigateur**, sur l'URL de preview : Playwright
ne rend pas les mêmes choses qu'un Safari iOS, et `/api/csp-report` est là pour
recueillir ce que la suite n'aura pas vu.
