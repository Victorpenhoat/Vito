# Refonte Core.Badakan — Slice B : Shell responsive — Design

**Date :** 2026-06-24
**Statut :** Validé (direction + décisions de cadrage). Plan d'implémentation à suivre.
**Branche :** `shell`

---

## 0. Contexte

Deuxième slice de la refonte Core.Badakan (après A — design system). Livre la **coquille d'app
responsive** : **sidebar fixe (desktop) ↔ barre d'onglets en bas + drawer (mobile)**, navigation pilotée
par les permissions RBAC, footer (carte utilisateur / sélecteur de langue / toggle thème). **Passe l'app
en sombre par défaut.** Remplace l'`AppNav` (barre du haut) de la Slice 1. Réutilise le kit UI de la
Slice A (`NavItem`, `Avatar`, `ThemeToggle`, `Modal`). Réf. `docs/design/core-badakan-shell-directive.md`.

## 1. Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Contenu nav | **Tous les modules, gatés RBAC.** client : Accueil, Restos, Vins, Recherche, Voyages, Famille, Comptes partagés, Conciergerie, Abonnement. + Agence (agence/admin), Back-office (admin). |
| « Accueil » | Pointe vers `/accueil` (**stub** créé en B, rempli en Slice C). Le post-login reste `/restos` (repointé en C). |
| Thème | **Sombre par défaut** (le défaut `data-theme` passe à `dark` ; `light` seulement si cookie explicite). Toggle dispo. |
| i18n | Locales **fr/en/it/es**. `en/it/es.json` = **copie de `fr.json`** (toutes clés présentes → pas d'erreur de clé manquante), avec **`nav`/`shell`/`app`/`auth` traduits** ; les modules restent en FR jusqu'à leur refonte. `LocaleSwitcher` dans le footer. |
| Mobile | Bottom-tab bar = 5 principaux (Accueil, Restos, Voyages, Recherche, **Plus**) ; le reste + Paramétrage/langue/thème/profil dans un **drawer**. |

## 2. Sombre par défaut (`src/app/[locale]/layout.tsx`)

Inverser le défaut : `const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";`
(sombre sauf si l'utilisateur a explicitement choisi clair). Les écrans métier restent lisibles (texte
hérité clair sur fond sombre ; boutons `bg-black` fonctionnels jusqu'à leur refonte). Le `ThemeToggle`
(Slice A) gère déjà la bascule + cookie.

## 3. i18n — locales en/it/es (`src/lib/i18n/routing.ts`, `messages/`)

- `routing.ts` : `locales: ["fr", "en", "it", "es"]`, `defaultLocale: "fr"`.
- `messages/en.json`, `it.json`, `es.json` : **dupliquer `fr.json`** intégralement (garantit toutes les
  clés), puis traduire les namespaces **`nav`, `shell`, `app`, `auth`** en EN/IT/ES. Le reste (modules)
  reste en FR — traduit au fil des refontes (dette assumée).
- `generateStaticParams` (déjà basé sur `routing.locales`) couvre les 4 locales automatiquement.

## 4. Architecture du shell (`src/features/shell/ui/`)

Le layout `(app)` (serveur) garde `requireRole`, récupère **rôle + nom d'affichage** (profil) et rend
`<AppShell>` :

- `AppShell` (**client**) — orchestre le responsive et l'état du drawer (`usePathname` pour l'actif) ;
  reçoit `role`, `userName`, et la **config de nav filtrée** (sérialisable : `{ key, href }[]` ; les
  icônes sont résolues côté client depuis `key`).
  - **Desktop (`md:`+)** : `Sidebar` fixe à gauche (~`264px`) + zone de contenu décalée (`md:pl-[264px]`).
  - **Mobile (`< md`)** : `BottomNav` fixe en bas (5 entrées) + `Drawer` (ouvert par un bouton
    avatar/burger d'un header mobile léger) pour le secondaire.
- `Sidebar` : en-tête logo (badge carré arrondi + « VITO » `tracking-wide`) ; liste de `NavItem`
  (icône lucide + libellé, actif/hover) ; **footer** (`ShellFooter`).
- `BottomNav` : 5 entrées principales (icône + label court), actif en accent. La 5ᵉ (« Plus ») ouvre le
  `Drawer`.
- `Drawer` : panneau latéral mobile (overlay) listant les entrées secondaires + `ShellFooter`.
- `ShellFooter` : **Paramétrage** (lien `/abonnement` ou `/gouts` ? → lien **Paramétrage** vers
  `/gouts` (préférences) ; à ajuster), séparateur, **carte utilisateur** (`Avatar` initiales + nom +
  rôle), `LocaleSwitcher` (`FR · EN · IT · ES`), `ThemeToggle`, et **Déconnexion** (`signOut`).
- `LocaleSwitcher` (**client**) : 4 langues ; change la locale via `usePathname`/`useRouter` de
  `@/lib/i18n/routing` (remplace le segment de locale en conservant le chemin).
- `data-testid` : `app-shell`, `sidebar`, `bottom-nav`, `drawer`, `drawer-open` (bouton), `nav-<key>`,
  `locale-switcher`, et conserver `theme-toggle` (kit).

### Config de nav (`src/features/shell/nav-config.ts`)

Liste ordonnée `{ key, href, roles? }` :
`accueil`(/accueil), `restos`(/restos), `vins`(/vins), `recherche`(/recherche), `voyages`(/voyages),
`famille`(/famille), `depenses`(/depenses), `conciergerie`(/conciergerie), `abonnement`(/abonnement),
`agence`(/agence, roles agence+admin), `admin`(/admin, roles admin). Le filtrage par rôle se fait côté
serveur (layout) ; un mapping `key → icône lucide` vit côté client (`AppShell`). Bottom-nav = sous-liste
`["accueil","restos","voyages","recherche"]` + entrée « Plus ».

## 5. « Accueil » stub (`src/app/[locale]/(app)/accueil/page.tsx`)

Page minimale (titre « Accueil » + court texte de bienvenue + lien vers `/restos`), `data-testid=
"accueil"`. Sera remplacée par le vrai dashboard en Slice C. Clé i18n `nav.accueil` + `accueil.*`.

## 6. Remplacement de l'`AppNav`

`src/features/shell/ui/AppNav.tsx` (barre du haut, Slice 1) est **supprimée** ; le layout `(app)` rend
`AppShell` à la place. L'e2e `e2e/navigation.spec.ts` est **réécrit** pour le nouveau shell (sidebar
desktop + bottom-nav/drawer mobile). Les `data-testid` `nav-<key>` sont conservés (continuité des liens).

## 7. Sécurité

- La garde d'accès `(app)` (`requireRole`) est **conservée** — frontière d'autorisation réelle. La nav
  RBAC (items conditionnels) est un **confort d'UI** ; un accès direct à une route non autorisée reste
  bloqué par la garde de page. `signOut` réutilisée. Le nom d'affichage vient du profil de la session
  (jamais d'un autre utilisateur). Pas de migration, pas de RLS.

## 8. Tests & seed

- **Seed** : inchangé (`client@vito.test`, `agence@vito.test`, `admin@vito.test`, `password123`).
- **Unit (Vitest)** : `filterNav(items, role)` (pur) — client ne voit ni agence ni admin ; agence voit
  agence pas admin ; admin voit tout. (+ helper de changement de locale si extrait.)
- **e2e (Playwright)** — viewports explicites :
  1. **Desktop** (`viewport ≥ 1024`) connecté client : `sidebar` visible, `bottom-nav` absent ; liens
     cœur présents ; `nav-restos` actif sur `/restos` ; `nav-admin` absent ; naviguer via `nav-voyages`
     → `/voyages`.
  2. **Mobile** (`viewport 390×844`) : `bottom-nav` visible, `sidebar` absent ; ouvrir le `drawer`
     (`drawer-open`) → entrées secondaires + footer visibles.
  3. **Thème** : `<html data-theme>` vaut `dark` par défaut (sans cookie) ; `theme-toggle` bascule.
  4. **Locale** : `locale-switcher` vers EN change l'URL en `/en/...` et un libellé de nav traduit
     apparaît (ex. `nav-restos` = « Restaurants »/EN).
  5. **RBAC** : admin voit `nav-admin` ; **gating** réel : client sur `/admin` reste bloqué (garde page).
  6. **Déconnexion** depuis le footer/drawer → `/login`.
  Signaux déterministes (testids, `toHaveAttribute`, `toHaveURL`). La suite existante reste verte (nav
  additive ; `nav-<key>` conservés).

## 9. Arbitrages / dette signalés

- **Traduction des modules** (EN/IT/ES) : différée (fichiers = copie FR pour les clés modules).
- **Vrai dashboard Accueil** : Slice C (le stub tient la place).
- **Polish interne des écrans métier** : slices ultérieures.
- **Drawer focus-trap / a11y avancée**, gestes tactiles, mémorisation de l'onglet : différés.
- Le **lien « Paramétrage »** pointe provisoirement vers `/gouts` (préférences) faute de page Réglages
  dédiée — une vraie page Réglages est différée.
