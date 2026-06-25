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
La branche `main` est protégée et exige le check `quality` (qui exécute `test:ci`) : aucun
déploiement en production n'est possible tant que la CI n'est pas verte.
