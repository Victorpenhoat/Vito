# 0001 — En-têtes de sécurité et CSP

**Date** : 9 septembre 2026 · **Statut** : accepté, CSP en Report-Only

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

## Ce qui reste

Le passage en vigueur (`Content-Security-Policy` au lieu de
`…-Report-Only`) doit être validé sur un vrai navigateur, sur l'URL de preview,
et non sous Playwright dont l'instrumentation fausse la mesure de `script-src`.
