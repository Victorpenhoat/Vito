# 0002 — Limitation de débit

**Date** : 9 septembre 2026 · **Statut** : accepté

## Constat

L'audit du 9 septembre cherchait `rateLimit|ratelimit|rate_limit` dans `src/` :
**zéro occurrence**. Les gardes d'auth empêchaient l'abus anonyme, jamais
l'abus d'un compte — le sien, ou un compte dont le jeton a fuité.

Ce qui est en jeu n'est pas la base, que la RLS protège, mais **l'argent et les
tiers** : chaque recherche d'adresse appelle Google Places, chaque lecture de
pièce d'identité ou d'étiquette appelle Anthropic. Une boucle, un onglet laissé
ouvert, et la facture court sans que rien ne casse — c'est même le pire cas :
une panne se voit, une facture non.

## Décision

**Le compteur vit en Postgres**, pas en mémoire et pas dans Redis.

En mémoire, il ne compterait rien : chaque instance serverless a la sienne, et
un démarrage à froid la remet à zéro. Redis (Upstash, Vercel KV) compterait
juste, mais ajouterait un service à tenir et un secret à faire tourner pour un
compteur qui tient dans une table. Les appels limités **touchent déjà la base**
— tous vérifient l'identité juste avant — donc le compteur ne coûte pas un
aller-retour de plus dans le chemin critique : il coûte une écriture.

**L'identité vient du jeton, jamais d'un argument.** `consommer_quota` lit
`auth.uid()` elle-même ; l'appelant ne choisit que l'action. Sans cela, on
pourrait brûler le quota d'autrui, ou s'en offrir un neuf en changeant de clé.
Sans identité du tout, la fonction refuse plutôt que de compter tout le monde
ensemble sur une clé partagée.

**La table n'a aucune policy.** RLS active et zéro policy : `authenticated` ne
peut ni lire son compteur ni l'effacer — l'effacer reviendrait à s'accorder un
quota neuf. Seule la fonction, en `security definer` avec `search_path = ''`,
y touche. Trois tests pgTAP le vérifient : lecture, suppression, remise à zéro.

**Fenêtre fixe, pas glissante.** Elle tient en une ligne et un index, là où une
fenêtre glissante demanderait de garder chaque appel. Le prix, connu et accepté :
on tolère jusqu'à deux fois la limite à cheval sur deux fenêtres. Pour un
garde-fou de coût, c'est sans conséquence.

**Le limiteur refuse en cas d'erreur.** Un limiteur qui s'ouvre quand la base
tousse n'en est pas un. Ici la rigueur ne coûte rien : toutes les actions
limitées ont besoin de la base juste après, elles auraient échoué de toute façon.

## Barèmes, et où ils mordent

| Action | Limite | Chemin |
|---|---|---|
| `recherche_lieu` | 40 / min | action `searchPlaces` — la saisie est déjà débruitée côté client |
| `photo_lieu` | 300 / min | `/api/places/photo` — une vignette par carte, large exprès |
| `lecture_document` | 12 / min | `/api/famille/documents/read` — facturé à l'appel |
| `lecture_etiquette` | 12 / min | `/api/vins/etiquette/read` — même fournisseur, même facture |
| `ajout_lieu` | 30 / min | `ajouterAuCarnet`, **uniquement** quand l'établissement est inconnu |

Les barèmes vivent dans `src/lib/securite/quota.ts`, côté serveur : le
navigateur n'a jamais son mot à dire.

Deux réponses différentes selon le lieu : les routes rendent **429**, tandis que
`searchPlaces` rend une liste vide — l'autocomplétion se tait, elle ne se casse
pas.

## Mesure

101 pgTAP (12 nouveaux), 773 unit (8 nouveaux), **178 e2e** dont une rafale qui
prouve le 429 au bout de la chaîne HTTP et l'isolation entre comptes. La suite
complète ne déclenche aucune limite : l'usage normal passe.

## Ce qui n'est pas limité

Les écritures ordinaires du carnet (notes, tags, favoris, dépenses) ne le sont
pas. Elles ne coûtent rien à personne et sont déjà bornées par la RLS ; les
limiter demanderait de toucher des dizaines d'actions pour un gain nul.
