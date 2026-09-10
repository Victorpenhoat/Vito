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
remonte — `script-src` bloquant `eval`, **76 fois**.

> **Correction du 10 septembre.** Ce document a d'abord imputé ces violations à
> l'instrumentation Playwright, en s'appuyant sur une recherche de `eval(` et
> `new Function(` dans les chunks. C'était faux, et la recherche était trop
> étroite : le coupable s'écrit **`Function(` sans `new`**, et c'est **Zod**.
>
> Zod compile ses validateurs en JIT et commence par tester si le navigateur
> l'y autorise, avec un `Function("")` sous `try/catch`. Sous notre CSP l'appel
> lève, Zod bascule proprement sur son chemin interprété — mais le navigateur
> signale la tentative. Rien n'était cassé ; le bruit, lui, était réel, et il
> venait de notre propre bundle. Mesuré sur la production : une violation sur
> `/fr` et une sur `/fr/login`, pointant `chunks/42xfeypmuyz-o.js`.
>
> Réglé par `config({ jitless: true })` dans `src/instrumentation-client.ts`,
> **côté client uniquement** : il n'y a pas de CSP côté serveur, où le JIT
> fonctionne et sert. Après correction, zéro violation sur les trois pages.
>
> La leçon vaut plus que le correctif : une absence de preuve avait été écrite
> ici comme une preuve d'absence.

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

**Ce que le Report-Only n'avait pas vu : `frame-src 'none'`.** La mesure portait
sur la carte, les restaurants et les vins ; les documents de famille n'en
étaient pas. Or `ScanProtege` affiche un scan **PDF** dans une `<iframe>` de
notre propre origine. En vigueur, le navigateur ne chargeait plus rien : le
lecteur redonnait son mot de passe pour voir un cadre vide, et le ticket à
usage unique n'était même pas consommé — c'est d'ailleurs ainsi que le test
e2e l'a dit, en recevant 200 là où il attendait 401 sur le rejeu du ticket.

La directive est passée à **`frame-src 'self'`**. À ne pas confondre avec
`frame-ancestors`, qui dit qui peut NOUS encadrer et reste à `'none'` : l'une
protège du clickjacking, l'autre décide de ce que nous affichons chez nous. Un
test unitaire les tient désormais côte à côte, précisément parce qu'elles se
ressemblent.

**`/_not-found` : deux portes, une seule page.** C'était la seule route
prérendue en statique, et le 404 par défaut de Next — anglais, dix scripts sans
nonce. Next distingue deux cas, et il faut les deux :

- `[locale]/not-found.tsx` répond aux `notFound()` des pages (fiche absente ou
  d'un autre compte). Rendu dans le layout, donc nonçé. Attention : cette
  version renvoie **200** dès que la réponse est en flux, pas 404.
- `global-not-found.tsx` répond aux URL sans route, que Next traite au niveau du
  routage — `not-found.tsx` ne les voit jamais. Il contourne le layout : la page
  porte donc sa propre coque HTML, ses polices, et le provider next-intl (sans
  lui, le lien de retour jette « No intl context »).

**`force-dynamic` est ce qui ferme le trou** : sans lui, `global-not-found` est
prérendu au build, où il n'existe ni requête ni nonce. Mesuré : la route passe
de `○ Static` à `ƒ Dynamic`, et les quatre langues répondent 404 avec zéro
script sans nonce.

## Ce qui reste

Un parcours cliqué sur un **vrai navigateur**, sur l'URL de preview : Playwright
ne rend pas les mêmes choses qu'un Safari iOS, et `/api/csp-report` est là pour
recueillir ce que la suite n'aura pas vu.
