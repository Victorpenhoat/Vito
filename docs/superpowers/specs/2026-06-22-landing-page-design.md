# Page d'accueil Vito (connexion + inscription) — Design

**Date :** 2026-06-22
**Statut :** Validé (design). Plan d'implémentation à suivre.
**Branche :** `landing-page`

---

## 0. Contexte

La page d'accueil `/fr` (`src/app/[locale]/page.tsx`) est encore le **gabarit par défaut** de
`create-next-app` : elle affiche le logo `next.svg` et le nom de l'app. Pour un produit destiné à de
vrais utilisateurs, on la remplace par une **vraie page d'accueil** présentant la marque et permettant
de **se connecter ou créer un compte** sans quitter l'accueil (disposition « tout-en-un » validée).

On réutilise l'existant : le composant `AuthForm` (e-mail + mot de passe) et les server actions `signIn`
/ `signUp` (`src/features/auth/data/actions.ts`), qui redirigent déjà vers `/restos` en cas de succès.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Disposition | **Tout-en-un** : marque + slogan, puis un panneau d'auth avec 2 onglets (Connexion / Inscription) sur l'accueil. |
| Slogan | **« Votre carnet personnel de sorties et de voyages »** |
| Utilisateur déjà connecté | **Redirection automatique vers `/restos`** (l'accueil ne montre pas un formulaire de login à quelqu'un de déjà connecté). |
| Réutilisation | `AuthForm` et les actions `signIn`/`signUp` existantes — **pas de duplication** de logique d'auth. |
| Hors périmètre (YAGNI) | Pas de contenu marketing long, pas de « mot de passe oublié », pas d'OAuth/réseaux sociaux. Les pages `/fr/login` et `/fr/signup` existantes restent inchangées. |

## 2. Composant `AuthPanel` (`src/features/auth/ui/AuthPanel.tsx`)

Composant **client** qui gère l'onglet actif et rebranche `AuthForm` sur la bonne action.

```tsx
"use client";
type Action = (prev: unknown, fd: FormData) => Promise<{ error: string } | undefined>;

export function AuthPanel({ signIn, signUp }: { signIn: Action; signUp: Action }) {
  // état: mode "login" | "signup" (défaut "login")
  // 2 boutons-onglets : t("login") = "Connexion", t("signupTab") = "Inscription"
  //   l'onglet actif est visuellement marqué (data-active / classe)
  // rend <AuthForm key={mode} action={mode==="login"?signIn:signUp} submitLabelKey={mode==="login"?"login":"signup"} />
  //   key={mode} réinitialise l'état du formulaire au changement d'onglet
}
```
- `Action` est exactement le type attendu par `AuthForm` ; `signIn`/`signUp` sont passées en props depuis
  la page (server component) — une server action est sérialisable en prop vers un composant client.
- `submitLabelKey` réutilise la convention de `AuthForm` (`t(submitLabelKey)` dans le namespace `auth`) :
  `"login"` → « Connexion », `"signup"` → « Créer un compte ».
- `data-testid` : `auth-panel`, et sur les onglets `tab-login` / `tab-signup`.

## 3. Page d'accueil (`src/app/[locale]/page.tsx`)

Devient un **server component** :
1. **Garde connecté** (première instruction) : `const supabase = await createServerSupabase();
   const { data } = await supabase.auth.getUser(); if (data.user) redirect({ href: "/restos", locale });`
   (`redirect` de `@/lib/i18n/routing`, `locale` via `getLocale()` ou `params`).
2. Sinon, rend la marque + le slogan + `<AuthPanel signIn={signIn} signUp={signUp} />` :
   - `t("name")` (= « Vito ») et `t("tagline")` via `getTranslations("app")`.
   - importe `signIn`, `signUp` depuis `@/features/auth/data/actions`.
3. **Supprime** l'`Image`/`next.svg` et le gabarit par défaut. `data-testid` : `landing`.

Style : épuré, centré, carte blanche sur fond clair, cohérent avec le reste (Tailwind). Responsive
(le panneau passe en pleine largeur sur mobile).

## 4. i18n (`messages/fr.json`)

- `app.tagline` = « Votre carnet personnel de sorties et de voyages » (nouveau ; `app.name` = « Vito »
  existe déjà).
- `auth.signupTab` = « Inscription » (nouveau ; libellé court de l'onglet, distinct de `auth.signup` =
  « Créer un compte » utilisé sur le bouton). `auth.login` = « Connexion » existe déjà.
- Aucune chaîne en dur.

## 5. Sécurité

- Aucune nouvelle surface d'auth : on réutilise `signIn`/`signUp` (validation Zod `credentialsSchema`,
  rôle `client` forcé par le trigger DB `handle_new_user`, jamais transmis depuis l'UI). La garde
  connecté utilise `auth.getUser()` (vérifié côté serveur). Pas de changement RLS ni de migration.

## 6. Tests & seed

- **Seed dev** : inchangé (compte `client@vito.test` / `password123` existe).
- **e2e (Playwright)** — contexte déconnecté :
  (1) `/fr` affiche `landing` avec « Vito », le slogan, et les onglets `tab-login` / `tab-signup` ;
  (2) cliquer `tab-signup` → le bouton de soumission affiche « Créer un compte » (bascule d'onglet) ;
  (3) se connecter depuis l'accueil (`client@vito.test` / `password123`) → redirection vers `/fr/restos`.
  Signaux déterministes (visibilité des testids, `toHaveURL`).
- Pas de test unitaire (composant purement présentationnel ; logique d'auth déjà couverte).

## 7. Arbitrages / dette signalés

- « Mot de passe oublié », vérification d'e-mail à l'inscription, OAuth → différés.
- Contenu marketing / captures / sections produit sur l'accueil → différés.
- Rattachement d'un domaine personnalisé (`badakan.com`) au projet Vercel → hors périmètre (action
  d'infra séparée).
