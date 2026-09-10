# Données protégées

Vito garde deux catégories de données qui ne se traitent pas comme le reste :
les **secrets d'accès** (numéros de pièces d'identité, codes de portail ou de
vestiaire) et les **documents** (scans d'identité, certificats médicaux —
données de santé au sens du RGPD).

Ce document dit comment elles sont protégées, et où le vérifier.

## 1. Rien en clair au repos

Tout est **chiffré en colonne**, en AES-256-GCM, avant d'atteindre la base :

| Quoi | Où | Comment |
|---|---|---|
| Fichiers (scans, vouchers, tickets, certificats) | `contenu_chiffre` | `src/lib/crypto/documents.ts` |
| Champs courts (numéros, codes) | `*_chiffre`, `valeur_chiffree` | `src/lib/crypto/champs.ts` |

La clé vient de `DOCUMENTS_ENCRYPTION_KEY` (32 octets en hexadécimal) et n'est
lue que côté serveur. **Sans clé, rien ne s'enregistre** : une action qui ne
peut pas chiffrer refuse plutôt que d'écrire en clair « pour dépanner ».

**Il n'y a aucun bucket de stockage.** C'est délibéré : une URL signée, même
courte, est une URL qui circule. Ici, les octets n'existent en clair nulle part
au repos, et une route authentifiée les déchiffre à la demande.

## 2. Une session valide ne vaut pas consentement récent

Un téléphone déverrouillé posé sur une table **est** une session valide. Toute
révélation redemande donc le mot de passe :

- `src/lib/auth/motDePasse.ts` vérifie le mot de passe **sans toucher à la
  session en cours** (client Supabase éphémère — un `signInWithPassword` sur le
  client de la requête écraserait les cookies de l'utilisateur) ;
- la valeur en clair ne part **que** dans la réponse de l'action de révélation.
  Les requêtes de page ne sélectionnent jamais la colonne chiffrée : la valeur
  n'est pas dans le HTML, même illisible ;
- le masque affiché fait **quatre points quelle que soit la longueur réelle** :
  un masque qui suit la longueur annonce combien de caractères chercher.

Pour les fichiers, la vérification délivre un **ticket à usage unique**, valable
deux minutes, dont la base ne garde que le haché (`emettre_reauth_ticket` /
`consommer_reauth_ticket`, migration 00036). La route de lecture l'exige :
sans ticket, **401**, même authentifié.

## 3. Chaque accès laisse une trace

`journal_acces` (migration 00055) consigne **qui, quoi, quand** — jamais la
valeur révélée, jamais l'adresse IP : un journal qui contiendrait le secret
n'aurait fait que le déplacer.

La table est **append-only**, et le `revoke update, delete` est explicite :
`authenticated` reçoit des privilèges par défaut sur le schéma `public`, si bien
que l'absence de policy annulerait une réécriture **en silence** — zéro ligne
touchée, aucune erreur. Un journal qu'on peut réécrire sans le savoir ne prouve
rien.

L'écriture du journal **ne peut pas faire échouer** une révélation : l'utilisateur
a donné son mot de passe, il a droit à sa donnée. Un journal indisponible est un
problème d'exploitation, pas une raison de lui refuser l'accès.

### Le journal des envois suit la même règle

`journal_envois` (migration 00061) est le second journal append-only, et il
existe pour une seule question : « je n'ai rien reçu » — est-ce parti, remis,
rebondi. Il garde donc le **genre** du message et son sort, **jamais son
contenu** : ni sujet, ni corps, ni lien. Un journal qui contiendrait le lien
magique n'aurait fait que le déplacer.

Ce qu'il garde et qui coûte : **l'adresse du destinataire, en clair**. C'est une
donnée personnelle, et c'est assumé — hachée, elle ne répondrait plus à la seule
question qui justifie la table. Elle est bornée par une **purge à 90 jours**
(`purger_journal_envois`), le délai qui répond au support sans constituer un
historique indéfini des adresses. La purge est écrite ; sa planification arrive
au lot 4, avec celle des comptes.

Mêmes protections que `journal_acces` : `select` sur ses propres lignes pour
`authenticated`, rien pour `anon`, écriture réservée au rôle de service, et
`revoke update, delete` explicite — pour la raison qui rend ce revoke
indispensable partout ici : sans lui, une réécriture passerait **en silence**.

**Ce journal ouvre une porte publique**, `POST /api/resend/webhook`, seule route
qui l'écrive sans session. Elle est tenue par trois règles : signature Svix
vérifiée avant toute lecture (`src/lib/mail/signature.ts`, HMAC sur
`id.horodatage.corps`, fenêtre de 5 minutes, comparaison à temps constant) ;
**secret absent = 500**, jamais d'ouverture par défaut ; et **aucune insertion**
— un identifiant inconnu est ignoré, sans quoi qui connaît l'URL remplirait la
table.

**Le chemin de connexion est devenu notre code** : depuis le lot 1 des mails, le
lien magique part par `envoyer()` et non plus par GoTrue. Deux conséquences
portées ici :

- l'origine du lien vient de la **configuration** en production
  (`NEXT_PUBLIC_APP_URL`), jamais de l'en-tête `Host` — un `Host` fourni par
  l'appelant enverrait le `token_hash` de la victime sur le domaine d'un tiers ;
- la **limitation de débit** que GoTrue appliquait est reprise côté application
  (5 liens par quart d’heure et par adresse, comptés dans ce journal), parce que
  `generateLink` est une opération d'administration qui contourne celle de
  GoTrue. Le refus est silencieux : la réponse de connexion est la même dans
  tous les cas, sinon elle laisserait énumérer les comptes.

Et la garde qui va avec : en production, l'absence de `RESEND_API_KEY`,
`RESEND_WEBHOOK_SECRET`, `MAIL_EXPEDITEUR` ou `NEXT_PUBLIC_APP_URL` **empêche le
démarrage** (`src/lib/env.ts`). Sans elle, un déploiement mal configuré
répondrait « regardez votre boîte » à tout le monde sans que rien ne parte.

## 4. Rien de protégé ne va en cache

Les routes de lecture répondent en `Cache-Control: private, no-store`. Le service
worker (`public/sw.js`) ne met **rien** en cache automatiquement : le mode voyage
hors ligne stocke uniquement ce que l'utilisateur a explicitement emporté. Les
codes et les documents d'activité n'en font pas partie.

## 5. La frontière reste la RLS

Le chiffrement protège les octets, pas les droits. L'isolation entre comptes est
tenue par les politiques RLS, éprouvées par **89 tests pgTAP**
(`supabase/tests/rls_test.sql`) : anon aveugle, propriétaire servi, tiers refusé
à chaque étage — y compris sur les écritures croisées, comme rattacher à son
activité le proche d'un autre compte.

## À vérifier avant d'ouvrir l'app à quelqu'un d'autre

- [ ] `DOCUMENTS_ENCRYPTION_KEY` différente en production et en staging
- [ ] `supabase test db` au vert
- [ ] aucune valeur protégée dans les journaux applicatifs (les actions ne
      renvoient qu'un message unique : « Vérification impossible »)
- [ ] les quatre variables d'e-mail renseignées en production — sinon le
      déploiement refuse de démarrer, et c'est voulu

## Garde-fous automatiques (9 septembre 2026)

Le job `securite` de la CI tourne à côté de `quality`, sans rejouer ni les
tests ni le build. Il regarde ce que le code **traîne**, et non ce qu'il fait :

| Outil | Ce qu'il refuse | Réglage |
|---|---|---|
| `knip` | fichier, export ou dépendance que personne n'utilise | `knip.json` |
| `npm audit --omit=dev` | faille connue de niveau `high` dans l'arbre **de production** | — |
| `gitleaks` | secret dans l'historique complet (371 commits) | `.gitleaks.toml` |

**Pourquoi l'audit ignore les dépendances de développement.** Capacitor CLI,
Storybook et Trapeze traînent des failles que personne ne sert à un
utilisateur. Les inclure rendrait le garde-fou rouge en permanence — donc
illisible, donc inutile. L'arbre de production, lui, est à **zéro
vulnérabilité**, transitives comprises.

**Pourquoi gitleaks a besoin de `fetch-depth: 0`.** Un secret retiré du dernier
commit vit toujours dans l'historique. Un scan superficiel ne prouverait rien.

**Les exceptions sont des VALEURS, jamais des chemins** (`.gitleaks.toml`) : la
clé de chiffrement de démonstration et les jetons de la pile Supabase locale,
tous deux publics par construction. Une vraie clé posée dans `.env.example` ou
dans un test serait toujours attrapée.
