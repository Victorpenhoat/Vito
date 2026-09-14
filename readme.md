# Vito

Carnet personnel de restaurants et de voyages sous forme de PWA.
Vito permet de consigner, retrouver et partager ses adresses coups de cœur,
organisées par ville et par type de cuisine.

## Développement

La spec et le plan d'implémentation se trouvent dans `docs/superpowers/`.
Lire ces fichiers avant de démarrer un nouveau chantier.

```bash
npm run dev   # serveur de développement sur http://localhost:3000
npm run lint  # ESLint
npm run build # build de production
```

### Travailler dans un worktree : une pile Supabase à soi

`supabase db reset` rejoue les migrations **du disque de celui qui lance la
commande**. Tant que deux worktrees partagent une pile locale, le reset de l'un
efface la migration en cours d'écriture de l'autre — c'est arrivé quatre fois
en deux heures le 12 septembre 2026, dont deux fois par des commandes de
courtoisie (« laisser la base propre en partant »). Le partage implicite rend
la discipline insuffisante.

Dans un worktree, avant tout autre chose :

```bash
cp ../../.env.local .        # les clés sont les mêmes ; seuls les ports changent
npm run supabase:worktree    # génère .supabase-local/ (ignoré par git)
npm run db:start             # démarre LA pile de ce worktree
npm run db:reset             # migrations + seed
```

Le script dérive du nom du worktree un décalage de ports stable — le même
worktree retrouve toujours sa pile — et met à jour son `.env.local`, y compris
`E2E_PORT` : sans lui, deux worktrees qui lancent Playwright en même temps se
disputent le port 3001, et le second teste l'application du premier.

`db:start`, `db:reset`, `db:types` et `test:rls` visent automatiquement la
bonne pile. Le checkout principal, lui, garde la pile par défaut (ports 543xx)
et n'a rien à faire.

## Utilisateurs de test

Ces comptes sont créés par `supabase/seed.sql` (mot de passe commun : **`password123`**).
Pour les (re)créer : `supabase db reset` (réapplique les migrations + le seed).

| Email | Rôle / état | Données pré-remplies |
|---|---|---|
| `client@vito.test` | client | 1 resto en liste (Le Bistrot Démo, favori), 1 vin (Château Démo 2019), 1 dégustation, goûts (bistrot, 17e), voyage Rome (sept. 2026) avec réservation hôtel, groupe de dépenses Rome partagé avec l'agence |
| `agence@vito.test` | agence | Membre du voyage Rome et du groupe de dépenses Rome du client |
| `admin@vito.test` | admin | Aucune donnée métier |
| `free@vito.test` | client — abonnement gratuit (aucune subscription) | Aucune donnée métier |
| `premium@vito.test` | client — abonnement premium actif (annuel, expire dans 1 an) | 1 demande conciergerie démo (statut "nouvelle") |
| `famille1@vito.test` | client (foyer — aucune famille pré-créée, l'e2e la crée) | Aucune donnée métier |
| `famille2@vito.test` | client (foyer — aucune famille pré-créée, l'e2e la crée) | Aucune donnée métier |
| `client7b@vito.test` | client — 0 voyage, aucun lien agence | Aucune donnée métier |

## Tests & garde-fou de déploiement

```bash
npm run test:ci   # reproduit la CI en local : typecheck → lint → unit → e2e
```

`test:ci` enchaîne les quatre étapes dans l'ordre — si l'une échoue, la chaîne s'arrête.

`npm run prod:ecart` dit si la production a bien reçu les migrations de ce checkout —
rien ne les pousse automatiquement, et une PR fusionnée part en production **avant** sa
table tant que personne n'a lancé `npx supabase db push`. Le même contrôle tourne en CI
après chaque fusion sur `main` (job `prod-a-jour`), mais il reste **inerte** tant que le
secret `SUPABASE_DB_URL` n'est pas configuré dans les réglages GitHub du dépôt : il le dit
alors dans le journal, plutôt que de passer au vert sans avoir rien vérifié. Ce secret est
une chaîne de connexion complète — le contrôle interroge la base et rien d'autre, sans
dépendre des droits d'un compte Supabase.

`npm run config:derive -- <project-ref>` fait le même travail pour ce qui ne vit **pas**
dans le dépôt : la configuration d'auth des projets distants. Il ne compare que les
réglages dont un écart est une panne — aujourd'hui le hook `custom_access_token`, et rien
d'autre : le `config.toml` local est un config de développement, il diffère légitimement
du distant sur une douzaine de points, et un contrôle qui crierait dessus serait ignoré en
une semaine. Le job `config-conforme` le lance sur la prod et le staging après chaque
fusion sur `main` (variables `SUPABASE_PROJECT_REF` et `SUPABASE_STAGING_REF`).

Pourquoi ce contrôle existe : le 14 septembre 2026, le hook était désactivé en production
**et** en staging, vraisemblablement depuis toujours — donc `is_agence()`, `is_concierge()`
et `is_admin()` rendaient `false` pour tout le monde, et aucun compte agence ou admin
n'avait ses droits en production. Les 251 assertions du filet RLS ne pouvaient rien y
faire : elles éprouvent le code, et c'est la configuration qui manquait.

⚠️ Ne jamais réparer une dérive par `supabase config push` : il envoie **tout** le
`config.toml` et écraserait le Site URL de production par `http://127.0.0.1:3000`. Le
tableau de bord, réglage par réglage.

`npm run test:rls` (pgTAP) exige une base dont l'état est connu : plusieurs assertions
comptent les lignes du seed, et un run e2e passé avant les fait rougir sans cause réelle.
Dans un worktree doté de sa pile, la commande remet donc la base à zéro toute seule ;
sur la pile partagée du checkout principal, elle ne le fait **pas** — un reset y effacerait
le travail d'une autre session — et le dit.
La branche `main` est protégée et exige le check `quality` (qui exécute `test:ci`) : aucun
déploiement en production n'est possible tant que la CI n'est pas verte.
