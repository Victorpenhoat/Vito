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
