# Garde-fou de déploiement (A+B+C+D) — Design

**Date :** 2026-06-25
**Statut :** Validé (diagnostic Étape 0 + périmètre A+B+C+D approuvé par le PO). Plan à suivre.
**Branche :** `deploy-guard`

---

## 0. Contexte

Diagnostic (Étape 0) : Vito a déjà Vitest (110 tests), Playwright (38 e2e), une CI `ci.yml`
(typecheck/lint/test/e2e sur Supabase locale), des comptes de test seedés, une PWA. **Manques réels** :
(A) le déploiement prod n'est **pas bloqué** par la CI (`main` non protégée, Vercel auto-déploie) ;
(B) pas de commande unique `test:ci` ; (C) pas de test PWA e2e ; (D) doc absente. On livre A+B+C+D.
**Non retenu** (redondant) : script `seed-test-users` via admin API + base de test hébergée — l'env de
test EST la Supabase locale (re-seedée), les comptes existent déjà via `seed.sql`.

## 1. Décisions de cadrage (validées)

| # | Décision |
|---|----------|
| A | **Protéger `main`** + exiger le check **`quality`** (la CI) avant merge ; pas de push direct, pas de force-push. Garde l'intégration Git Vercel : `main` n'avance qu'après CI verte → **prod jamais déployée sur du rouge**. |
| B | Scripts npm : `test:ci` = `typecheck && lint && test && test:e2e` (reproduit la CI en local) ; `test:unit` = `vitest run`. |
| C | **Test PWA e2e** : manifest lié + servi/valide, service worker enregistré, critères d'installabilité de base. |
| D | **README** : section « Utilisateurs de test » (comptes seed + rôles/états + reset) + « Tests & garde-fou » (test:ci, blocage du déploiement). |
| — | **Pas** de script seed-test-users (redondant). Profils réels = rôles `client/agence/admin` + états d'abonnement `free`/`premium` (déjà seedés). |

## 2. A — Protection de branche (action contrôleur)

Via `gh api -X PUT repos/Victorpenhoat/Vito/branches/main/protection` : `required_status_checks` =
`{ strict: true, contexts: ["quality"] }` ; `enforce_admins` (au choix du PO) ; `required_pull_request_reviews`
optionnel ; `allow_force_pushes: false` ; pas de push direct (PR obligatoire). Effectué **après** le merge
de cette slice (pour ne pas bloquer sa propre PR de façon circulaire). Le check `quality` existe déjà
(nom du job dans `ci.yml`). C'est une **config repo** (droits admin GitHub du PO) — exécutée par le
contrôleur, confirmée au PO.

## 3. B — Scripts (`package.json`)

```jsonc
"test:unit": "vitest run",
"test:ci": "npm run typecheck && npm run lint && npm run test && npm run test:e2e"
```
`test:ci` reproduit l'ordre de la CI (hors `supabase start`, supposé déjà lancé en local). Livrable :
`npm run test:ci` en local = ce que fait la CI.

## 4. C — Test PWA e2e (`e2e/pwa.spec.ts`)

Contre le build prod (webServer Playwright = `next build && next start`) :
- `/fr` contient `<link rel="manifest" href="/manifest.webmanifest">` ; `page.request.get` du manifest →
  200 + JSON avec `name`, `start_url`, `display`, `icons` non vide.
- **Service worker** : après chargement, `navigator.serviceWorker.getRegistration()` finit par renvoyer
  une registration (le `PwaRegister` enregistre `/sw.js`) ; `/sw.js` répond 200.
- Installabilité **basique** : présence manifest + SW + `display: standalone` (proxy raisonnable ; pas de
  test de `beforeinstallprompt`, non déterministe).
- Robustesse : attendre la registration (polling court) ; pas de `networkidle`.

## 5. D — README

- **Utilisateurs de test** : tableau des comptes seed (`client@`, `agence@`, `admin@`, `free@`,
  `premium@`, `famille1/2@`, `client7b@` `vito.test`), leur rôle/état et données pré-remplies, + la
  commande de (re)génération : `supabase db reset` (ré-applique migrations + `seed.sql`). Mot de passe
  commun `password123`.
- **Tests & garde-fou de déploiement** : lancer `npm run test:ci` en local (= la CI) ; expliquer que
  `main` est protégée et que le check `quality` doit passer → aucun déploiement prod sur du rouge.

## 6. Sécurité

- Aucun secret en clair ; pas de nouvelle variable. La protection de branche est une config repo (pas de
  code). Le test PWA est en lecture seule. Pas de migration.

## 7. Tests

- Le livrable EST le test : `npm run test:ci` vert localement ; la suite e2e (incl. PWA) verte ; build OK.
- Vérifier après A que la protection est active (`gh api .../branches/main/protection` → 200, contexts
  contient `quality`).

## 8. Arbitrages / dette signalés

- Tests RLS *isolés* (au-delà de la couverture e2e actuelle) : possible amélioration future, non requise.
- `enforce_admins` : laissé au choix du PO (strict = même les admins passent par la CI).
