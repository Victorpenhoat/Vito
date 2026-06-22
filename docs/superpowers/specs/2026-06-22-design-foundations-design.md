# Refonte visuelle — Slice 1 : Fondations + navigation (design system) — Design

**Date :** 2026-06-22
**Statut :** Validé (direction visuelle via maquette). Plan d'implémentation à suivre.
**Branche :** `design-foundations`

---

## 0. Contexte

L'app n'a **aucune charte visuelle ni navigation** : le layout est nu (`<html><body>{children}`),
la police est l'Arial par défaut, il n'existe **aucun menu** (on ne peut naviguer qu'en tapant l'URL),
et chaque écran bricole son Tailwind. D'où le « c'est pas beau ».

Direction validée par maquette (artifact) : **moderne épuré (SaaS)**, **accent indigo**, **barre de
navigation en haut**, mode clair. Cette Slice 1 pose les **fondations** qui embellissent tout l'app d'un
coup ; le polish fin de chaque écran métier viendra dans des slices ultérieurs.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Direction | Moderne épuré (SaaS), **accent indigo** (`#4f46e5`), coins arrondis, ombres légères, beaucoup d'air. |
| Navigation | **Barre en haut** (top nav), présente sur tous les écrans de l'app, avec état actif, avatar et déconnexion. |
| Mode | **Clair** (baseline). Le mode sombre auto actuel est retiré pour cette slice (cohérent avec la maquette) → différé. |
| Police | **Pile système** (rapide, lisible, sans dépendance externe). |
| Périmètre Slice 1 | Tokens de design + coquille d'app (nav) + restylage **accueil + formulaires d'auth**. **Pas** le restylage interne de chaque page métier (hérite déjà police/couleurs/nav ; polish dédié plus tard). |

## 2. Tokens de design (`src/app/globals.css`)

Tailwind v4 (config CSS via `@theme`). On définit des tokens réutilisables comme classes utilitaires
(`bg-accent`, `text-accent`, `bg-surface`, etc.) :

```css
@import "tailwindcss";

@theme {
  --color-accent: #4f46e5;
  --color-accent-600: #4338ca;
  --color-accent-50: #eef2ff;
  --color-ink: #0f172a;
  --color-muted: #64748b;
  --color-line: #e2e8f0;
  --color-surface: #ffffff;
  --color-canvas: #f8fafc;
  --radius-card: 16px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```
- Retire les anciens `--background`/`--foreground` et le bloc `@media (prefers-color-scheme: dark)`
  (mode sombre différé).
- Les écrans existants héritent immédiatement de la police système + du fond clair.

## 3. Coquille d'app : barre de navigation

### 3.1 Composant `AppNav` (`src/features/shell/ui/AppNav.tsx`) — client

- Props : `{ role: "client" | "agence" | "admin" }`.
- Rend une barre supérieure (`<header>`) : marque **« Vito. »** (le point en accent) à gauche, liens de
  navigation au centre (défilables horizontalement sur mobile), avatar (initiale) + **Déconnexion** à
  droite.
- Liens (via `Link` de `@/lib/i18n/routing`) : Restos, Voyages, Dépenses, Famille, Conciergerie, Vins,
  Abonnement. Liens **conditionnels au rôle** : « Agence » si `role ∈ {agence, admin}` ; « Admin » si
  `role === admin`.
- **État actif** : `usePathname()` (de `@/lib/i18n/routing`) ; un lien est actif si le pathname commence
  par sa cible (classe accent : `bg-accent-50 text-accent-600`).
- **Déconnexion** : `<form action={signOut}>` (server action existante `@/features/auth/data/actions`,
  sans argument) + bouton.
- `data-testid` : `app-nav`, et sur chaque lien `nav-<clé>` (ex. `nav-restos`).

### 3.2 Intégration (`src/app/[locale]/(app)/layout.tsx`)

Le layout existant garde déjà l'accès (`requireRole([...])`). On l'enrichit :
```tsx
import { requireRole, getSessionRole } from "@/lib/rbac/guards";
import { AppNav } from "@/features/shell/ui/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["client", "agence", "admin"]);
  const role = (await getSessionRole()) ?? "client";
  return (
    <div className="min-h-dvh">
      <AppNav role={role} />
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
```
La nav apparaît ainsi sur **tous** les écrans de l'app sans toucher chaque page. Les pages gardent leur
propre `<main>` (inchangées).

## 4. Restylage accueil + auth

- **Accueil** (`src/app/[locale]/page.tsx`) : reprendre la maquette — fond clair avec un léger dégradé
  d'accent en haut, carte centrée (`rounded-[var(--radius-card)] border border-line shadow`), marque
  « Vito. », slogan en `text-muted`. La redirection des connectés et la structure restent (Slice
  précédente).
- **`AuthPanel`** (`src/features/auth/ui/AuthPanel.tsx`) : onglets en **pilule** (conteneur
  `bg-canvas`/gris, onglet actif `bg-surface` + ombre légère) au lieu du soulignement actuel. Conserver
  `role="tablist"`/`role="tab"`/`aria-selected` et les `data-testid` existants.
- **`AuthForm`** (`src/features/auth/ui/AuthForm.tsx`) : champs `rounded-xl border border-line` avec
  focus accent ; bouton principal `bg-accent text-white rounded-xl`. Conserver labels i18n,
  `useActionState`, le `role="alert"` d'erreur.
- **Pages `/login` et `/signup`** (`(auth)/login|signup/page.tsx`) : envelopper le `AuthForm` dans la
  même carte centrée que l'accueil (cohérence), sans changer leur logique.

## 5. i18n (`messages/fr.json`)

Nouveau namespace `nav` : `restos`, `voyages`, `depenses`, `famille`, `conciergerie`, `vins`,
`abonnement`, `agence`, `admin`, `deconnexion`. Aucune chaîne en dur dans `AppNav`.

## 6. Sécurité

- Aucune nouvelle surface : la garde d'accès `(app)` (`requireRole`) est conservée ; les liens
  conditionnels (agence/admin) sont un **confort d'UI**, l'autorisation réelle reste côté pages/RLS
  (un client qui force `/admin` est déjà redirigé par la garde de la page admin). `signOut` réutilisée.
- Pas de migration, pas de changement DB/RLS.

## 7. Tests & seed

- **Seed** : inchangé. Comptes existants suffisent (`client@vito.test`, `agence@vito.test`,
  `admin@vito.test` / `password123`).
- **e2e (Playwright)** :
  (1) connecté en `client@vito.test`, sur `/fr/restos` la barre `app-nav` est visible avec les liens
  cœur (`nav-restos`, `nav-voyages`, …) ; le lien `nav-restos` porte l'état actif ; `nav-admin` est
  **absent** pour un client ;
  (2) cliquer `nav-voyages` navigue vers `/fr/voyages` (URL change, nav toujours visible) ;
  (3) la **déconnexion** depuis la nav renvoie vers `/fr/login` ;
  (4) en `admin@vito.test`, `nav-admin` est **présent**.
  Signaux déterministes (testids, `toHaveURL`). La suite e2e existante (landing, modules) reste verte
  (la nav est additive ; les pages métier ne changent pas de comportement).
- Pas de test unitaire (présentationnel).

## 8. Arbitrages / dette signalés

- **Mode sombre** : retiré pour cette slice → ré-introduction propre (palette sombre dédiée) différée.
- **Polish interne des écrans métier** (cartes restos, listes voyages, tableaux dépenses/admin, etc.) →
  slices ultérieurs, écran par écran.
- **Menu mobile dédié** (burger/onglets bas) : pour cette slice, la barre défile horizontalement sur
  petit écran ; un menu mobile soigné est différé.
- **Logo graphique** (au-delà du mot « Vito. ») → différé.
- Composants UI partagés (Button/Input/Card réutilisables) : on reste sur des classes Tailwind +
  tokens ; une extraction en primitives viendra si la duplication le justifie.
