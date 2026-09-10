# Mails — Lot 1 : la voie d'envoi et son journal

**Date** : 10 septembre 2026 · **Statut** : à relire

## Constat

Un seul e-mail part aujourd'hui de Vito : le **lien magique**. Et il ne part pas
de Vito — il part de GoTrue, le service d'authentification de Supabase, par SMTP,
avec six lignes de HTML nu (`supabase/templates/magic_link.html`). L'application
n'a aucune bibliothèque d'envoi, aucun journal, aucune trace.

Ce qui manque tient en une phrase : **quand quelqu'un dit « je n'ai rien reçu »,
personne ne peut lui répondre.** Ni si le message est parti, ni s'il a été remis,
ni s'il a rebondi.

Le PO veut à terme cinq e-mails (lien magique, invitation, rappels d'activités,
partage de voyage, dépenses), tracés, à l'image de Vito, et qui arrivent. Ce lot
ne livre aucun des quatre nouveaux : il livre la **voie** qu'ils emprunteront, et
la fait éprouver par le seul qui existe déjà.

## Décisions

### Vito envoie, GoTrue n'envoie plus

Le lien magique passe par la même voie que les futurs. L'alternative — laisser
GoTrue envoyer et ne tracer que les autres — laisserait hors du journal **le
message le plus fréquent de la plateforme**, celui-là même dont on nous dira
qu'il n'arrive pas. Un journal troué à l'endroit du problème n'est pas un
journal.

Concrètement : `auth.admin.generateLink({ type: "magiclink" })` rend le lien sans
l'envoyer ; `envoyer()` s'en charge. Le gabarit de GoTrue devient mort et sera
supprimé au lot 2.

**Ce que cela met en jeu.** Le chemin de connexion devient notre responsabilité :
un bug ici enferme tout le monde dehors. Trois garde-fous, dans l'ordre où ils
agissent :

1. `generateLink` **ne crée pas de compte** pour une adresse inconnue, comme
   `shouldCreateUser: false` aujourd'hui. L'inscription reste sur invitation.
2. **La réponse de l'action ne change pas d'un iota** selon que le compte existe
   ou non. C'est déjà la règle (« la réponse est TOUJOURS la même ») et elle
   n'est pas cosmétique : une réponse qui varie laisse énumérer les comptes. Un
   test le vérifie sur les deux branches.
3. Le lot ne part pas en production sans que `auth-lien-magique.spec.ts` passe
   sur la nouvelle voie.

### Resend, et pourquoi pas du SMTP

`envoyer()` parle à **Resend** : région européenne, une clé d'API au lieu
d'identifiants SMTP à faire tourner, et surtout des **webhooks de remise et de
rebond** — sans lesquels « savoir ce qui est parti » s'arrête à « parti », qui
est la moitié inintéressante de la question.

Le SMTP direct (Brevo, SendGrid) ferait partir les messages aussi bien, mais ne
dirait rien de leur sort sans travail supplémentaire.

### Le journal est append-only, comme celui des accès

`journal_envois` suit `journal_acces` (migration 00055) au caractère près, pour
la même raison : `authenticated` reçoit des privilèges par défaut sur le schéma
`public`, si bien qu'une absence de policy annulerait une réécriture **en
silence** — zéro ligne touchée, aucune erreur. D'où le `revoke update, delete`
explicite.

```sql
create table public.journal_envois (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles (id) on delete set null,
  destinataire text not null,
  genre        text not null check (genre in
                 ('lien_magique','invitation','rappel_activites','partage_voyage','depense')),
  fournisseur_id text,
  statut       text not null default 'en_cours'
                 check (statut in ('en_cours','accepte','remis','rebond','plainte','echec')),
  detail       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index journal_envois_user_date_idx on public.journal_envois (user_id, created_at desc);
create unique index journal_envois_fournisseur_idx on public.journal_envois (fournisseur_id)
  where fournisseur_id is not null;
create trigger journal_envois_set_updated_at before update on public.journal_envois
  for each row execute function public.set_updated_at();
```

Quatre choix qui méritent leur ligne :

- **`user_id` est nullable et `on delete set null`.** Une invitation part vers
  quelqu'un qui n'a pas encore de compte ; et un compte supprimé ne doit pas
  emporter la preuve qu'un message lui a été envoyé.
- **`destinataire` est en clair.** C'est une donnée personnelle, et c'est
  assumé : hachée, elle ne répondrait plus à la seule question que ce journal
  existe pour trancher. Elle est bornée par une purge (ci-dessous).
- **Aucun contenu n'est journalisé** — ni sujet, ni corps, ni lien. Le genre
  suffit à savoir ce qui est parti, et un journal qui contiendrait le lien
  magique n'aurait fait que le déplacer, exactement comme pour `journal_acces`.
- **`statut` part à `en_cours`, jamais à `accepte`.** La ligne s'écrit AVANT
  l'appel à Resend (voir `envoyer()`) : à ce moment-là rien n'a été accepté, et
  une valeur optimiste ferait mentir le journal si le processus mourait pendant
  l'appel. `accepte` signifie « Resend a accusé réception » — ce qui ne promet
  pas la remise ; seul le webhook fait passer à `remis`. Une ligne restée
  `en_cours` est donc, en soi, un signal : l'appel n'est jamais revenu.

**RLS** : `select` sur ses propres lignes pour `authenticated`, rien pour `anon`,
`insert` réservé au rôle de service (le journal s'écrit côté serveur, y compris
pour un destinataire non connecté). `revoke update, delete` explicite.

**Purge** : les lignes de plus de **90 jours** sont supprimées. Le délai répond
au support (« je n'ai rien reçu la semaine dernière ») sans constituer un
historique indéfini des adresses. La purge attend la même planification que
celle notée en 00039 — donc **elle est écrite ici mais déclenchée au lot 4**, et
le spec de ce lot doit s'en souvenir.

### Le webhook, calqué sur celui de Stripe

`POST /api/resend/webhook`, `runtime = "nodejs"` (corps brut nécessaire à la
vérification de signature), signature vérifiée avant toute lecture, `logActionError`
sur chaque branche d'échec — c'est le patron de `/api/stripe/webhook`, éprouvé.

Il fait une seule chose : retrouver la ligne par `fournisseur_id` et avancer son
`statut`. **Il n'écrit jamais une ligne qui n'existe pas** : un événement pour un
identifiant inconnu est ignoré avec un log, pas inséré — sans quoi n'importe qui
sachant l'URL remplirait la table.

Le statut n'avance jamais à reculons : `remis` ne redevient pas `accepte`. Les
webhooks arrivent dans le désordre, et c'est la seule protection qui tienne.

### La fonction `envoyer()`

Un seul point de passage, `src/lib/mail/envoyer.ts` :

```ts
envoyer({ a, genre, sujet, html, texte, userId? }): Promise<{ id: string } | null>
```

- **Elle journalise avant d'appeler Resend** (`en_cours`), puis met à jour :
  `accepte` avec le `fournisseur_id`, ou `echec` avec le détail. Une ligne
  `echec` vaut mieux qu'un envoi dont il ne reste rien.
- **Elle ne jette jamais.** Un e-mail est un effet de bord : qu'il échoue ne doit
  pas faire échouer l'action qui l'a demandé — même raison que pour le journal
  des accès, où « l'écriture ne peut pas faire échouer une révélation ». Elle
  rend `null` et trace.
- **Sans `RESEND_API_KEY`, elle ne part pas et n'échoue pas** : elle journalise
  en `echec` avec le détail « non configuré ». C'est l'état du développement
  local et de la CI, où aucun message ne doit sortir.

### Configuration

`env.ts` gagne `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` et `MAIL_EXPEDITEUR`,
toutes optionnelles, avec le même `refine` que Stripe : la clé présente rend les
deux autres obligatoires. Une configuration à moitié faite est ce qui produit les
pannes qu'on ne comprend pas.

**L'expéditeur est `contact@vito.app`** (décision PO du 10 septembre). C'est une
adresse à laquelle on peut répondre, pas un `no-reply` — donc quelqu'un doit lire
cette boîte : un lien magique qui n'arrive pas produira une réponse, et c'est
tant mieux. Elle reste distincte de `CONTACT_EMAIL`, qui n'existe que pour
l'affichage sur `/confidentialite` : les deux valent la même chose aujourd'hui,
et rien n'oblige qu'elles le restent.

**Hors du code, et bloquant : le domaine.** Tant que `vito.app` n'est pas vérifié
chez Resend (SPF, DKIM, DMARC), les messages partent en indésirable. C'est une
action DNS du PO, à faire avant la mise en service — le code, lui, peut être
écrit et testé sans.

## Ce que ce lot ne livre pas

Les quatre nouveaux e-mails (lot 3 et 4), la charte graphique et les quatre
langues (lot 2), la planification et le désabonnement (lot 4). Le lien magique
gardera donc son HTML nu jusqu'au lot 2 : ce lot déplace la voie, pas l'allure.

## Vérification

- **Unitaire** : `envoyer()` sans clé → ligne `echec`, aucun appel réseau ;
  un envoi réussi laisse `accepte` et jamais `en_cours` ;
  Resend en erreur → ligne `echec`, la fonction rend `null` sans jeter ; le
  webhook n'avance jamais un statut à reculons et ignore un identifiant inconnu.
- **pgTAP** : `anon` ne lit rien de `journal_envois` ; un tiers ne lit pas les
  lignes d'un autre ; `update` et `delete` sont refusés à `authenticated`
  (les trois mêmes que pour `quotas` et `journal_acces`).
- **e2e** : `auth-lien-magique.spec.ts` passe sur la nouvelle voie ; une demande
  de lien pour une adresse **inconnue** rend exactement la même réponse que pour
  une connue — c'est le test qui garde la non-énumération.
- **À la main, en préversion** : un vrai envoi, et la ligne qui passe à `remis`
  quand le webhook arrive. C'est la seule preuve que la chaîne tient de bout en
  bout ; elle ne peut pas être automatisée sans boîte de réception.

## Risques

**Le chemin de connexion devient notre code.** C'est le vrai coût de la décision
principale. Atténué par les trois garde-fous, mais il reste : si `generateLink`
change de comportement à une montée de Supabase, c'est la connexion qui casse,
pas un rappel d'activité. À re-tester aux montées de version.

**Le webhook est une URL publique.** Un envoyeur hostile qui devine l'URL ne peut
qu'être refusé par la signature — mais si `RESEND_WEBHOOK_SECRET` venait à
manquer, la route doit refuser, pas s'ouvrir. Elle répond 500 et ne lit rien,
comme celle de Stripe.
