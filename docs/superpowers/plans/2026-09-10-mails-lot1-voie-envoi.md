# Mails lot 1 — la voie d'envoi et son journal · plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire passer tout e-mail sortant de Vito par un point unique, tracé de bout en bout — et le prouver en y faisant passer le lien magique, aujourd'hui envoyé par GoTrue sans laisser de trace.

**Architecture:** Une table `journal_envois` append-only sur le modèle de `journal_acces` ; un service `mail` bâti comme `taux-change` (interface, fournisseur réel, variante « aucun », sélecteur) qui parle à l'API Resend en `fetch`, sans SDK ; une fonction `envoyer()` qui journalise avant, appelle après, et ne jette jamais ; un webhook signé qui fait avancer le statut. Le lien magique est généré par l'Admin API et envoyé par cette voie.

**Tech Stack:** Next.js (App Router, route handlers `runtime = "nodejs"`), Supabase (Postgres, RLS, pgTAP), Resend via son API REST, `node:crypto` pour la signature Svix, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-mails-lot1-voie-envoi-design.md`

## Global Constraints

- **Aucune dépendance nouvelle.** Resend s'appelle en `fetch` (patron `src/lib/services/taux-change/frankfurter.ts`) et la signature Svix se vérifie avec `node:crypto`. Le job CI `securite` fait tourner `knip`, qui refuse une dépendance inutilisée.
- **Code, commentaires et messages en français**, comme tout le dépôt.
- **Expéditeur : `contact@vito.app`** (décision PO du 10 septembre 2026).
- **Contenu des e-mails : rien de nominatif.** Aucun nom de proche, aucun montant, aucun type de pièce. Ce lot n'envoie que le lien magique, mais la règle vaut dès maintenant.
- **Le journal ne contient jamais de contenu** : ni sujet, ni corps, ni lien. Genre, destinataire, statut, horodatage.
- **`revoke update, delete` explicite** sur toute table de journal : `authenticated` a des privilèges par défaut sur `public`, une simple absence de policy annulerait une réécriture en silence.
- **Jamais de total absolu dans un test** (pgTAP ou e2e) : la base locale est partagée entre les suites. Compter des deltas ou filtrer sur ses propres lignes.
- **`npm run db:types` après toute migration**, sinon le typage ment.
- **Vérification avant de pousser** : `npm run typecheck && npm run lint && npm run test`.

---

### Task 1 : La table, ses barrières et sa purge

**Files:**
- Create: `supabase/migrations/00061_journal_envois.sql`
- Modify: `supabase/tests/rls_test.sql` (ajout en fin, avant `select finish();`)
- Modify: `src/types/database.types.ts` (régénéré, pas édité à la main)

**Interfaces:**
- Consumes: rien.
- Produces: la table `public.journal_envois` (colonnes ci-dessous) et la fonction `public.purger_journal_envois() returns integer`, toutes deux utilisées par les tâches 3 et 4.

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/00061_journal_envois.sql` :

```sql
-- Journal des e-mails sortants (lot 1 « mails »).
--
-- Il existe pour répondre à une seule question : « je n'ai rien reçu » — est-ce
-- parti, est-ce arrivé, a-t-il rebondi. D'où ce qu'on garde, et ce qu'on ne
-- garde pas : le GENRE du message et son sort, jamais son contenu. Un journal
-- qui contiendrait le lien magique n'aurait fait que le déplacer, exactement
-- comme pour journal_acces (00055).

create table public.journal_envois (
  id             uuid primary key default gen_random_uuid(),
  -- Nullable : une invitation part vers quelqu'un qui n'a pas encore de compte.
  -- set null : un compte supprimé n'emporte pas la preuve qu'on lui a écrit.
  user_id        uuid references public.profiles (id) on delete set null,
  destinataire   text not null,
  genre          text not null check (genre in
                   ('lien_magique','invitation','rappel_activites','partage_voyage','depense')),
  fournisseur_id text,
  -- 'en_cours' est l'état INITIAL, écrit avant l'appel au fournisseur : à cet
  -- instant rien n'a été accepté. Une ligne restée 'en_cours' est un signal —
  -- l'appel n'est jamais revenu.
  statut         text not null default 'en_cours'
                   check (statut in ('en_cours','accepte','remis','rebond','plainte','echec')),
  detail         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index journal_envois_user_date_idx on public.journal_envois (user_id, created_at desc);
-- Le webhook retrouve la ligne par cet identifiant : il doit être unique, et il
-- est absent tant que le fournisseur n'a pas répondu.
create unique index journal_envois_fournisseur_idx on public.journal_envois (fournisseur_id)
  where fournisseur_id is not null;

create trigger journal_envois_set_updated_at before update on public.journal_envois
  for each row execute function public.set_updated_at();

alter table public.journal_envois enable row level security;

-- On lit ses propres envois, rien d'autre. L'écriture appartient au serveur
-- (rôle de service, qui contourne la RLS) : un e-mail part souvent vers
-- quelqu'un qui n'est pas connecté, parfois qui n'a pas de compte.
create policy "journal_envois_select_self" on public.journal_envois
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.journal_envois from anon;
grant select on public.journal_envois to authenticated;
-- Explicite, et c'est le cœur du dispositif : sans ce revoke, un update
-- passerait la RLS sans erreur et ne toucherait aucune ligne — en silence.
revoke insert, update, delete on public.journal_envois from authenticated;

-- Purge : le journal répond au support (« la semaine dernière »), il ne
-- constitue pas un historique indéfini des adresses. 90 jours.
--
-- Écrite ici, DÉCLENCHÉE AU LOT 4 : la planification (Vercel Cron ou pg_cron)
-- est une décision qui déborde des e-mails — la purge des comptes l'attend
-- aussi (cf. commentaire de 00039).
create or replace function public.purger_journal_envois()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supprimes integer;
begin
  delete from public.journal_envois where created_at < now() - interval '90 days';
  get diagnostics v_supprimes = row_count;
  return v_supprimes;
end;
$$;

revoke all on function public.purger_journal_envois() from public;
```

- [ ] **Step 2 : Écrire les tests pgTAP**

Dans `supabase/tests/rls_test.sql`, **avant** `select finish();`, ajouter :

```sql
-- ── Journal des envois (00061) ──────────────────────────────────────────────
select has_table('public', 'journal_envois', 'la table du journal des envois existe');

insert into public.journal_envois (user_id, destinataire, genre, statut)
values ('11111111-1111-1111-1111-111111111111', 'a@vito.test', 'lien_magique', 'accepte'),
       ('22222222-2222-2222-2222-222222222222', 'b@vito.test', 'lien_magique', 'accepte');

-- anon ne voit rien. C'est l'invariant que le dépôt verrouille partout, et il
-- tient au `revoke all ... from anon`, pas à une policy.
select is(tests.count_as_anon('select count(*) from public.journal_envois'),
  0::bigint, 'anon ne lit rien du journal des envois');

-- On voit les siens, et uniquement les siens.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'select count(*) from public.journal_envois where destinataire = ''a@vito.test'''),
  1::bigint, 'on lit son propre envoi');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'select count(*) from public.journal_envois where destinataire = ''b@vito.test'''),
  0::bigint, 'on ne lit pas l''envoi d''un autre compte');

-- Le journal ne se réécrit pas. C'est le revoke qui tient cela, pas la RLS.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'with u as (update public.journal_envois set statut = ''remis'' returning 1) select count(*) from u'),
  0::bigint, 'on ne réécrit pas le statut d''un envoi');
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'with d as (delete from public.journal_envois returning 1) select count(*) from d'),
  0::bigint, 'on n''efface pas une ligne du journal');

-- La purge ne prend que le vieux.
insert into public.journal_envois (user_id, destinataire, genre, created_at)
values ('11111111-1111-1111-1111-111111111111', 'vieux@vito.test', 'lien_magique',
        now() - interval '91 days');
select ok(public.purger_journal_envois() >= 1, 'la purge supprime au moins la ligne de 91 jours');
select is((select count(*) from public.journal_envois where destinataire = 'vieux@vito.test'),
  0::bigint, 'la ligne de 91 jours a disparu');
select is((select count(*) from public.journal_envois where destinataire = 'a@vito.test'),
  1::bigint, 'la ligne récente est restée');
```

- [ ] **Step 3 : Lancer les tests, vérifier qu'ils échouent d'abord**

```bash
supabase db reset   # la suite e2e contamine la base : repartir propre
npm run test:rls
```

Attendu **avant** d'appliquer la migration : échec sur `has_table` (« la table du journal des envois existe »).
`supabase db reset` applique les migrations, donc pour voir le rouge, lancer d'abord `npm run test:rls` sur une base où `00061` n'existe pas encore — c'est-à-dire avant d'écrire le fichier de migration, ou en le renommant temporairement en `.sql.off`.

- [ ] **Step 4 : Appliquer et vérifier le vert**

```bash
supabase db reset
npm run test:rls
```

Attendu : les 8 nouvelles assertions passent, et **aucune assertion existante ne casse**.

- [ ] **Step 5 : Régénérer les types**

```bash
npm run db:types
npm run typecheck
```

Attendu : `journal_envois` apparaît dans `src/types/database.types.ts`, `tsc` est muet.

- [ ] **Step 6 : Commit**

```bash
git add supabase/migrations/00061_journal_envois.sql supabase/tests/rls_test.sql src/types/database.types.ts
git commit -m "feat(mails): le journal des envois, append-only comme celui des accès"
```

---

### Task 2 : Le service Resend, sans SDK

**Files:**
- Create: `src/lib/services/mail/types.ts`
- Create: `src/lib/services/mail/resend.ts`
- Create: `src/lib/services/mail/aucun.ts`
- Create: `src/lib/services/mail/index.ts`
- Test: `src/lib/services/mail/resend.test.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `env` depuis `@/lib/env`.
- Produces:
  - `type Message = { de: string; a: string; sujet: string; html: string; texte: string }`
  - `type MessageEnvoye = { id: string }`
  - `interface MailProvider { readonly name: string; envoyer(m: Message): Promise<MessageEnvoye | null> }`
  - `function getMailProvider(): MailProvider`
  Utilisés par la tâche 3.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/lib/services/mail/resend.test.ts` :

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { ResendMailProvider } from "./resend";

const provider = new ResendMailProvider("cle-de-test", "contact@vito.app");

const message = {
  a: "lecteur@vito.test",
  sujet: "Votre lien de connexion",
  html: "<p>lien</p>",
  texte: "lien",
};

function repond(corps: unknown, ok = true) {
  const mock = vi.fn().mockResolvedValue({ ok, json: async () => corps } as Response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe("ResendMailProvider", () => {
  it("poste le message et rend l'identifiant du fournisseur", async () => {
    const fetchMock = repond({ id: "re_123" });
    expect(await provider.envoyer(message)).toEqual({ id: "re_123" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cle-de-test");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "contact@vito.app",
      to: "lecteur@vito.test",
      subject: "Votre lien de connexion",
      html: "<p>lien</p>",
      text: "lien",
    });
  });

  it("rend null plutôt que de jeter quand le fournisseur refuse", async () => {
    repond({ message: "domaine non vérifié" }, false);
    expect(await provider.envoyer(message)).toBeNull();
  });

  it("rend null quand le réseau tombe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(await provider.envoyer(message)).toBeNull();
  });

  it("rend null si la réponse n'a pas d'identifiant : sans lui le webhook ne retrouvera rien", async () => {
    repond({});
    expect(await provider.envoyer(message)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

```bash
npx vitest run src/lib/services/mail/resend.test.ts
```

Attendu : FAIL, `Cannot find module './resend'`.

- [ ] **Step 3 : Écrire les types**

Créer `src/lib/services/mail/types.ts` :

```ts
export type Message = {
  // Pas d'expéditeur ici : il est configuré une fois (MAIL_EXPEDITEUR) et
  // appartient au fournisseur. Un appelant qui pourrait le choisir pourrait
  // le choisir mal.
  a: string;
  sujet: string;
  /** Corps HTML. Le lot 2 lui donnera l'allure de Vito ; ici il est nu. */
  html: string;
  /** Version texte : certains clients ne rendent que celle-là, et son absence pèse dans le classement en indésirable. */
  texte: string;
};

export type MessageEnvoye = {
  /** Identifiant du fournisseur — c'est par lui que le webhook retrouvera la ligne du journal. */
  id: string;
};

export interface MailProvider {
  readonly name: string;
  /**
   * `null` quand le message n'est pas parti, quelle qu'en soit la raison —
   * refus du fournisseur, réseau, réponse inattendue. Le fournisseur ne jette
   * jamais : un e-mail est un effet de bord, il ne doit pas faire échouer
   * l'action qui l'a demandé.
   */
  envoyer(m: Message): Promise<MessageEnvoye | null>;
}
```

- [ ] **Step 4 : Écrire le fournisseur Resend**

Créer `src/lib/services/mail/resend.ts` :

```ts
import { log, errorContext } from "@/lib/log";
import type { MailProvider, Message, MessageEnvoye } from "./types";

// Resend en `fetch`, sans SDK : le dépôt fait déjà ainsi pour Frankfurter, et
// une dépendance de plus est une dépendance à tenir à jour et à auditer.
export class ResendMailProvider implements MailProvider {
  readonly name = "resend";

  constructor(
    private readonly cle: string,
    private readonly expediteur: string,
  ) {}

  async envoyer(m: Message): Promise<MessageEnvoye | null> {
    try {
      const reponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cle}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.expediteur,
          to: m.a,
          subject: m.sujet,
          html: m.html,
          text: m.texte,
        }),
      });
      const corps: unknown = await reponse.json().catch(() => null);
      if (!reponse.ok) {
        log.warn("mail_refuse", { fournisseur: this.name, detail: detailDe(corps) });
        return null;
      }
      const id = (corps as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || id.length === 0) {
        log.warn("mail_sans_identifiant", { fournisseur: this.name });
        return null;
      }
      return { id };
    } catch (err) {
      log.warn("mail_injoignable", { fournisseur: this.name, ...errorContext(err) });
      return null;
    }
  }
}

function detailDe(corps: unknown): string {
  const message = (corps as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message.slice(0, 200) : "refus sans détail";
}
```

- [ ] **Step 5 : Écrire la variante « aucun » et le sélecteur**

Créer `src/lib/services/mail/aucun.ts` :

```ts
import { log } from "@/lib/log";
import type { MailProvider, Message } from "./types";

// Aucun fournisseur configuré — l'état du développement local et de la CI, où
// AUCUN message ne doit sortir. On ne fait pas semblant d'avoir envoyé : le
// journal en gardera une ligne `echec`, ce qui est la vérité.
export class AucunMailProvider implements MailProvider {
  readonly name = "aucun";
  async envoyer(m: Message): Promise<null> {
    log.info("mail_non_configure", { a: m.a, sujet: m.sujet });
    return null;
  }
}
```

Créer `src/lib/services/mail/index.ts` :

```ts
import { env } from "@/lib/env";
import { ResendMailProvider } from "./resend";
import { AucunMailProvider } from "./aucun";
import type { MailProvider } from "./types";

export function getMailProvider(): MailProvider {
  if (env.RESEND_API_KEY && env.MAIL_EXPEDITEUR) {
    return new ResendMailProvider(env.RESEND_API_KEY, env.MAIL_EXPEDITEUR);
  }
  return new AucunMailProvider();
}

export type { MailProvider, Message, MessageEnvoye } from "./types";
```

- [ ] **Step 6 : Déclarer la configuration**

Dans `src/lib/env.ts`, ajouter au `z.object` (après les lignes `STRIPE_*`) :

```ts
    // Envoi d'e-mails (lot 1 « mails »). Absentes : rien ne part, et le journal
    // le dit — c'est l'état du développement local et de la CI.
    RESEND_API_KEY: z.string().optional(),
    RESEND_WEBHOOK_SECRET: z.string().optional(),
    MAIL_EXPEDITEUR: z.string().email().optional(),
```

Ajouter un second `.refine` à la suite du `.refine` existant :

```ts
  .refine((v) => !v.RESEND_API_KEY || (v.RESEND_WEBHOOK_SECRET && v.MAIL_EXPEDITEUR), {
    message:
      "RESEND_API_KEY présent : RESEND_WEBHOOK_SECRET et MAIL_EXPEDITEUR sont requis — " +
      "une configuration à moitié faite produit les pannes qu'on ne comprend pas",
  })
```

Et dans l'objet passé à `schema.safeParse({ ... })`, ajouter :

```ts
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
  MAIL_EXPEDITEUR: process.env.MAIL_EXPEDITEUR,
```

Dans `.env.example`, ajouter :

```
# E-mails sortants (lot 1). Sans ces trois-là, rien ne part et le journal le dit.
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
MAIL_EXPEDITEUR=contact@vito.app
```

- [ ] **Step 7 : Lancer les tests, vérifier le vert**

```bash
npx vitest run src/lib/services/mail/
npm run typecheck
```

Attendu : 4 tests au vert, `tsc` muet.

- [ ] **Step 8 : Commit**

```bash
git add src/lib/services/mail src/lib/env.ts .env.example
git commit -m "feat(mails): le fournisseur Resend, en fetch et sans SDK"
```

---

### Task 3 : `envoyer()`, le point de passage unique

**Files:**
- Create: `src/lib/mail/envoyer.ts`
- Test: `src/lib/mail/envoyer.test.ts`

**Interfaces:**
- Consumes: `getMailProvider()` et le type `Message` (tâche 2) ; la table `journal_envois` (tâche 1) ; `createAdminClient()` de `@/lib/supabase/admin`.
- Produces:
  - `type Genre = "lien_magique" | "invitation" | "rappel_activites" | "partage_voyage" | "depense"`
  - `async function envoyer(p: { a: string; genre: Genre; sujet: string; html: string; texte: string; userId?: string }): Promise<{ id: string } | null>`
  Utilisée par la tâche 6.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/lib/mail/envoyer.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const envoyerFournisseur = vi.fn();
vi.mock("@/lib/services/mail", () => ({
  getMailProvider: () => ({ name: "faux", envoyer: envoyerFournisseur }),
}));

// Le client admin est réduit à ce que `envoyer()` en fait : insert ... select single,
// puis update ... eq. On garde la trace des appels pour les assertions.
const inserees: Record<string, unknown>[] = [];
const misesAJour: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (ligne: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            inserees.push(ligne);
            return { data: { id: "ligne-1" }, error: null };
          },
        }),
      }),
      update: (champs: Record<string, unknown>) => ({
        eq: async () => {
          misesAJour.push(champs);
          return { error: null };
        },
      }),
    }),
  }),
}));

import { envoyer } from "./envoyer";

const message = {
  a: "lecteur@vito.test",
  genre: "lien_magique" as const,
  sujet: "Votre lien de connexion",
  html: "<p>lien</p>",
  texte: "lien",
};

beforeEach(() => {
  inserees.length = 0;
  misesAJour.length = 0;
  envoyerFournisseur.mockReset();
});

describe("envoyer", () => {
  it("journalise en 'en_cours' AVANT d'appeler le fournisseur", async () => {
    envoyerFournisseur.mockResolvedValue({ id: "re_1" });
    await envoyer(message);
    expect(inserees[0]).toMatchObject({
      destinataire: "lecteur@vito.test",
      genre: "lien_magique",
      statut: "en_cours",
    });
  });

  it("ne journalise ni le sujet ni le corps", async () => {
    envoyerFournisseur.mockResolvedValue({ id: "re_1" });
    await envoyer(message);
    const ligne = JSON.stringify(inserees[0]);
    expect(ligne).not.toContain("connexion");
    expect(ligne).not.toContain("lien");
  });

  it("passe la ligne à 'accepte' avec l'identifiant du fournisseur", async () => {
    envoyerFournisseur.mockResolvedValue({ id: "re_1" });
    expect(await envoyer(message)).toEqual({ id: "re_1" });
    expect(misesAJour[0]).toMatchObject({ statut: "accepte", fournisseur_id: "re_1" });
  });

  it("passe la ligne à 'echec' et rend null quand le fournisseur ne part pas", async () => {
    envoyerFournisseur.mockResolvedValue(null);
    expect(await envoyer(message)).toBeNull();
    expect(misesAJour[0]).toMatchObject({ statut: "echec" });
  });

  it("ne jette jamais, même si le fournisseur jette : un e-mail ne fait pas échouer l'action", async () => {
    envoyerFournisseur.mockRejectedValue(new Error("boum"));
    await expect(envoyer(message)).resolves.toBeNull();
    expect(misesAJour[0]).toMatchObject({ statut: "echec" });
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

```bash
npx vitest run src/lib/mail/envoyer.test.ts
```

Attendu : FAIL, `Cannot find module './envoyer'`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/lib/mail/envoyer.ts` :

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailProvider } from "@/lib/services/mail";
import { log, errorContext } from "@/lib/log";

export type Genre =
  | "lien_magique"
  | "invitation"
  | "rappel_activites"
  | "partage_voyage"
  | "depense";

export type Envoi = {
  a: string;
  genre: Genre;
  sujet: string;
  html: string;
  texte: string;
  /** Absent pour un destinataire sans compte (invitation). */
  userId?: string;
};

/**
 * Le point de passage unique de tout e-mail sortant de Vito.
 *
 * Trois règles, et elles se tiennent :
 *
 * 1. On journalise AVANT d'appeler le fournisseur, en `en_cours`. Une valeur
 *    optimiste ferait mentir le journal si le processus mourait pendant l'appel.
 * 2. On ne journalise ni le sujet ni le corps. Le genre suffit à savoir ce qui
 *    est parti ; un journal qui contiendrait le lien magique l'aurait déplacé.
 * 3. On ne jette JAMAIS. Un e-mail est un effet de bord : qu'il échoue ne doit
 *    pas faire échouer l'action qui l'a demandé — même raison que pour le
 *    journal des accès, où l'écriture ne peut pas faire échouer une révélation.
 */
export async function envoyer(p: Envoi): Promise<{ id: string } | null> {
  let ligneId: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("journal_envois")
      .insert({
        user_id: p.userId ?? null,
        destinataire: p.a,
        genre: p.genre,
        statut: "en_cours",
      })
      .select()
      .single();
    if (error || !data) {
      log.error("journal_envois_insert", { genre: p.genre, message: error?.message });
    } else {
      ligneId = data.id;
    }

    const envoye = await getMailProvider().envoyer({
      a: p.a,
      sujet: p.sujet,
      html: p.html,
      texte: p.texte,
    });

    await marquer(ligneId, envoye ? { statut: "accepte", fournisseur_id: envoye.id } : { statut: "echec", detail: "non parti" });
    return envoye;
  } catch (err) {
    log.error("mail_envoyer", { genre: p.genre, ...errorContext(err) });
    await marquer(ligneId, { statut: "echec", detail: "exception" }).catch(() => {});
    return null;
  }
}

async function marquer(ligneId: string | null, champs: Record<string, unknown>): Promise<void> {
  if (!ligneId) return;
  const admin = createAdminClient();
  const { error } = await admin.from("journal_envois").update(champs).eq("id", ligneId);
  if (error) log.error("journal_envois_update", { message: error.message });
}
```

**Note pour l'implémenteur :** `envoyer()` ne choisit pas l'expéditeur — le fournisseur le connaît (`MAIL_EXPEDITEUR`, injecté au constructeur en tâche 2). C'est délibéré : un appelant qui pourrait le choisir pourrait le choisir mal.

- [ ] **Step 4 : Lancer les tests, vérifier le vert**

```bash
npx vitest run src/lib/mail/
npm run typecheck
```

Attendu : 5 tests au vert.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/mail
git commit -m "feat(mails): envoyer(), qui journalise avant d'appeler et ne jette jamais"
```

---

### Task 4 : Le webhook, signé et sans marche arrière

**Files:**
- Create: `src/lib/mail/signature.ts`
- Test: `src/lib/mail/signature.test.ts`
- Create: `src/lib/mail/statut.ts`
- Test: `src/lib/mail/statut.test.ts`
- Create: `src/app/api/resend/webhook/route.ts`

**Interfaces:**
- Consumes: `env.RESEND_WEBHOOK_SECRET` (tâche 2), la table `journal_envois` (tâche 1).
- Produces: `function signatureValide(...)`, `function statutDepuisEvenement(type: string): Statut | null`, `function avance(actuel: Statut, nouveau: Statut): boolean`. Rien d'autre ne les consomme dans ce lot.

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `src/lib/mail/statut.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { statutDepuisEvenement, avance } from "./statut";

describe("statutDepuisEvenement", () => {
  it("traduit les événements qui nous intéressent", () => {
    expect(statutDepuisEvenement("email.delivered")).toBe("remis");
    expect(statutDepuisEvenement("email.bounced")).toBe("rebond");
    expect(statutDepuisEvenement("email.complained")).toBe("plainte");
  });

  it("ignore les autres plutôt que d'inventer un statut", () => {
    expect(statutDepuisEvenement("email.delivery_delayed")).toBeNull();
    expect(statutDepuisEvenement("n'importe.quoi")).toBeNull();
  });
});

describe("avance", () => {
  it("laisse progresser", () => {
    expect(avance("en_cours", "accepte")).toBe(true);
    expect(avance("accepte", "remis")).toBe(true);
  });

  // Les webhooks arrivent dans le désordre : c'est la seule protection qui tienne.
  it("refuse de reculer", () => {
    expect(avance("remis", "accepte")).toBe(false);
    expect(avance("remis", "remis")).toBe(false);
  });

  it("laisse un rebond ou une plainte l'emporter sur une remise", () => {
    expect(avance("remis", "rebond")).toBe(true);
    expect(avance("remis", "plainte")).toBe(true);
  });
});
```

Créer `src/lib/mail/signature.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { signatureValide } from "./signature";

const SECRET = "whsec_" + Buffer.from("clef-de-test-longue-assez").toString("base64");
const CORPS = '{"type":"email.delivered"}';
const ID = "msg_1";

function signer(id: string, ts: string, corps: string, secret = SECRET): string {
  const brut = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return "v1," + createHmac("sha256", brut).update(`${id}.${ts}.${corps}`).digest("base64");
}

const maintenant = () => Math.floor(Date.now() / 1000).toString();

describe("signatureValide", () => {
  it("accepte une signature correcte et récente", () => {
    const ts = maintenant();
    expect(signatureValide(SECRET, ID, ts, CORPS, signer(ID, ts, CORPS))).toBe(true);
  });

  it("refuse un corps modifié — c'est tout l'objet", () => {
    const ts = maintenant();
    const sig = signer(ID, ts, CORPS);
    expect(signatureValide(SECRET, ID, ts, '{"type":"email.bounced"}', sig)).toBe(false);
  });

  it("refuse une signature d'un autre secret", () => {
    const ts = maintenant();
    const autre = "whsec_" + Buffer.from("un-autre-secret-entierement").toString("base64");
    expect(signatureValide(SECRET, ID, ts, CORPS, signer(ID, ts, CORPS, autre))).toBe(false);
  });

  // Sans fenêtre, une requête interceptée se rejoue indéfiniment.
  it("refuse un horodatage trop vieux", () => {
    const vieux = (Math.floor(Date.now() / 1000) - 3600).toString();
    expect(signatureValide(SECRET, ID, vieux, CORPS, signer(ID, vieux, CORPS))).toBe(false);
  });

  it("accepte quand l'en-tête porte plusieurs signatures, dont la bonne", () => {
    const ts = maintenant();
    const entete = "v1,dGVzdA== " + signer(ID, ts, CORPS);
    expect(signatureValide(SECRET, ID, ts, CORPS, entete)).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx vitest run src/lib/mail/statut.test.ts src/lib/mail/signature.test.ts
```

Attendu : FAIL, modules introuvables.

- [ ] **Step 3 : Écrire `statut.ts`**

```ts
export type Statut = "en_cours" | "accepte" | "remis" | "rebond" | "plainte" | "echec";

// Traduction des événements Resend. Ce qui n'est pas listé est ignoré : un
// statut inventé vaut moins que pas de statut du tout.
const DEPUIS_EVENEMENT: Record<string, Statut> = {
  "email.delivered": "remis",
  "email.bounced": "rebond",
  "email.complained": "plainte",
};

export function statutDepuisEvenement(type: string): Statut | null {
  return DEPUIS_EVENEMENT[type] ?? null;
}

// Les webhooks arrivent dans le désordre : un « envoyé » peut suivre un
// « remis ». On ne recule donc jamais — sauf qu'un rebond ou une plainte
// l'emportent, parce qu'ils disent quelque chose qu'une remise ne dit pas.
const RANG: Record<Statut, number> = {
  en_cours: 0,
  echec: 1,
  accepte: 1,
  remis: 2,
  rebond: 3,
  plainte: 4,
};

export function avance(actuel: Statut, nouveau: Statut): boolean {
  return RANG[nouveau] > RANG[actuel];
}
```

- [ ] **Step 4 : Écrire `signature.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

// Vérification de la signature Svix (le transport de webhooks qu'utilise
// Resend), à la main : `node:crypto` suffit, et une dépendance de plus est une
// dépendance à auditer.
//
// La signature couvre `<id>.<horodatage>.<corps>` : sans l'id et l'horodatage,
// une requête interceptée se rejouerait telle quelle.
const FENETRE_SECONDES = 300;

export function signatureValide(
  secret: string,
  id: string,
  horodatage: string,
  corps: string,
  entete: string,
): boolean {
  const ts = Number(horodatage);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > FENETRE_SECONDES) return false;

  const brut = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const attendue = createHmac("sha256", brut).update(`${id}.${horodatage}.${corps}`).digest();

  // L'en-tête peut porter plusieurs signatures séparées par des espaces (rotation
  // de secret) : il suffit qu'une corresponde.
  return entete.split(" ").some((part) => {
    const [version, valeur] = part.split(",");
    if (version !== "v1" || !valeur) return false;
    const fournie = Buffer.from(valeur, "base64");
    return fournie.length === attendue.length && timingSafeEqual(fournie, attendue);
  });
}
```

- [ ] **Step 5 : Lancer, vérifier le vert**

```bash
npx vitest run src/lib/mail/
```

Attendu : les 5 + 5 nouvelles assertions passent, plus les 5 de `envoyer`.

- [ ] **Step 6 : Écrire la route**

Créer `src/app/api/resend/webhook/route.ts` :

```ts
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { logActionError } from "@/lib/actionError";
import { createAdminClient } from "@/lib/supabase/admin";
import { signatureValide } from "@/lib/mail/signature";
import { statutDepuisEvenement, avance, type Statut } from "@/lib/mail/statut";

// Corps brut requis pour la vérif de signature → runtime nodejs (pas edge).
// Même patron que /api/stripe/webhook, éprouvé.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!env.RESEND_WEBHOOK_SECRET) {
    // Refuser, jamais s'ouvrir : un webhook non configuré est une porte, pas un détail.
    logActionError("resend.webhook.misconfigured", new Error("RESEND_WEBHOOK_SECRET manquant"));
    return new Response("configuration Resend manquante", { status: 500 });
  }

  const corps = await request.text();
  const id = request.headers.get("svix-id") ?? "";
  const horodatage = request.headers.get("svix-timestamp") ?? "";
  const signature = request.headers.get("svix-signature") ?? "";

  if (!signatureValide(env.RESEND_WEBHOOK_SECRET, id, horodatage, corps, signature)) {
    log.warn("resend_webhook_signature");
    return new Response("signature invalide", { status: 400 });
  }

  let evenement: { type?: unknown; data?: { email_id?: unknown } };
  try {
    evenement = JSON.parse(corps);
  } catch {
    return new Response("corps illisible", { status: 400 });
  }

  const nouveau = typeof evenement.type === "string" ? statutDepuisEvenement(evenement.type) : null;
  const fournisseurId = evenement.data?.email_id;
  if (!nouveau || typeof fournisseurId !== "string") {
    return new Response(null, { status: 200 }); // événement sans intérêt : accusé, ignoré
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("journal_envois")
      .select("id, statut")
      .eq("fournisseur_id", fournisseurId)
      .maybeSingle();

    // Un identifiant inconnu est IGNORÉ, jamais inséré : sans quoi qui sait
    // l'URL remplit la table.
    if (!data) {
      log.warn("resend_webhook_inconnu", { fournisseur_id: fournisseurId });
      return new Response(null, { status: 200 });
    }
    if (!avance(data.statut as Statut, nouveau)) return new Response(null, { status: 200 });

    await admin.from("journal_envois").update({ statut: nouveau }).eq("id", data.id);
  } catch (err) {
    logActionError("resend.webhook.maj", err);
    return new Response("erreur de mise à jour", { status: 500 }); // Resend rejouera
  }
  return new Response(null, { status: 200 });
}
```

- [ ] **Step 7 : Vérifier**

```bash
npx vitest run src/lib/mail/
npm run typecheck && npm run lint
```

- [ ] **Step 8 : Commit**

```bash
git add src/lib/mail/signature.ts src/lib/mail/signature.test.ts src/lib/mail/statut.ts src/lib/mail/statut.test.ts src/app/api/resend/webhook/route.ts
git commit -m "feat(mails): le webhook Resend, signé et sans marche arrière"
```

---

### Task 5 : Le transport local, pour que la preuve de bout en bout survive

**Pourquoi cette tâche existe.** `e2e/auth-lien-magique.spec.ts` ne se contente pas de vérifier qu'un formulaire répond : il **lit la boîte Mailpit locale, en extrait le lien et l'ouvre** pour vérifier qu'il connecte et mène à l'accueil. C'est le seul test du dépôt qui prouve la chaîne complète. Dès que GoTrue cesse d'envoyer (tâche 6), plus rien n'arrive dans Mailpit et ce test meurt. Il faut donc un transport local **avant** de débrancher GoTrue.

**Files:**
- Create: `src/lib/services/mail/mailpit.ts` *(issue A)* ou `src/lib/services/mail/fichier.ts` *(issue B)*
- Modify: `src/lib/services/mail/index.ts`, `src/lib/env.ts`, `.env.example`, `.github/workflows/ci.yml`
- Test: `src/lib/services/mail/mailpit.test.ts` *(issue A)* ou `fichier.test.ts` *(issue B)*

**Interfaces:**
- Consumes: `MailProvider`, `Message` (tâche 2).
- Produces: un troisième fournisseur, choisi par `getMailProvider()` quand aucune clé Resend n'est configurée mais qu'un transport local l'est.

- [ ] **Step 1 : Mesurer, ne pas supposer**

Mailpit expose une API d'envoi HTTP depuis la v1.14, mais la version embarquée par la CLI Supabase de ce dépôt n'a **pas été vérifiée** (Docker était arrêté au moment d'écrire ce plan). C'est cette mesure qui décide de l'issue :

```bash
supabase start
curl -s http://127.0.0.1:54324/api/v1/info
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:54324/api/v1/send \
  -H "Content-Type: application/json" \
  -d '{"From":{"Email":"contact@vito.app"},"To":[{"Email":"sonde@vito.test"}],"Subject":"sonde","Text":"corps"}'
```

**200 ou 201 → issue A.** **404 → issue B.** Notez le résultat dans le message de commit : la prochaine personne n'aura pas à re-mesurer.

- [ ] **Step 2A (issue A) : Le fournisseur Mailpit**

Créer `src/lib/services/mail/mailpit.ts` :

```ts
import { log, errorContext } from "@/lib/log";
import type { MailProvider, Message, MessageEnvoye } from "./types";

// Transport LOCAL uniquement : dépose le message dans la boîte Mailpit que la
// pile Supabase fait déjà tourner, pour que l'e2e continue de lire un vrai
// message, d'en extraire le lien et de l'ouvrir. Rien de tout cela ne part sur
// le réseau.
export class MailpitMailProvider implements MailProvider {
  readonly name = "mailpit";

  constructor(
    private readonly base: string,
    private readonly expediteur: string,
  ) {}

  async envoyer(m: Message): Promise<MessageEnvoye | null> {
    try {
      const reponse = await fetch(`${this.base.replace(/\/$/, "")}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: this.expediteur },
          To: [{ Email: m.a }],
          Subject: m.sujet,
          Text: m.texte,
          HTML: m.html,
        }),
      });
      if (!reponse.ok) {
        log.warn("mail_local_refuse", { statut: reponse.status });
        return null;
      }
      const corps = (await reponse.json().catch(() => null)) as { ID?: unknown } | null;
      const id = typeof corps?.ID === "string" ? corps.ID : `mailpit-${Date.now()}`;
      return { id };
    } catch (err) {
      log.warn("mail_local_injoignable", errorContext(err));
      return null;
    }
  }
}
```

Test `src/lib/services/mail/mailpit.test.ts` :

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { MailpitMailProvider } from "./mailpit";

const provider = new MailpitMailProvider("http://127.0.0.1:54324", "contact@vito.app");
const message = { a: "lecteur@vito.test", sujet: "Sujet", html: "<p>x</p>", texte: "x" };

afterEach(() => vi.unstubAllGlobals());

describe("MailpitMailProvider", () => {
  it("dépose le message dans la boîte locale", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ID: "m1" }) } as Response);
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider.envoyer(message)).toEqual({ id: "m1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(JSON.parse(init.body as string).To).toEqual([{ Email: "lecteur@vito.test" }]);
  });

  it("rend null si la boîte locale n'est pas là, sans jeter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await provider.envoyer(message)).toBeNull();
  });
});
```

- [ ] **Step 2B (issue B) : Le fournisseur fichier**

Si Mailpit ne sait pas recevoir en HTTP, on écrit le message sur le disque et l'e2e le lit là — plus de dépendance à la boîte de Supabase, et la preuve de bout en bout est conservée.

Créer `src/lib/services/mail/fichier.ts` :

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { log, errorContext } from "@/lib/log";
import type { MailProvider, Message, MessageEnvoye } from "./types";

// Transport LOCAL uniquement : écrit le message en JSON dans un dossier que
// l'e2e lit. Jamais actif en production — le sélecteur ne le choisit que
// lorsque MAIL_DOSSIER_LOCAL est renseignée, ce qu'elle n'est pas là-bas.
export class FichierMailProvider implements MailProvider {
  readonly name = "fichier";

  constructor(private readonly dossier: string) {}

  async envoyer(m: Message): Promise<MessageEnvoye | null> {
    try {
      await mkdir(this.dossier, { recursive: true });
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await writeFile(
        join(this.dossier, `${id}.json`),
        JSON.stringify({ a: m.a, sujet: m.sujet, texte: m.texte, html: m.html }, null, 2),
        "utf8",
      );
      return { id };
    } catch (err) {
      log.warn("mail_fichier", errorContext(err));
      return null;
    }
  }
}
```

Test `src/lib/services/mail/fichier.test.ts` :

```ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FichierMailProvider } from "./fichier";

let dossier: string;
afterEach(async () => { if (dossier) await rm(dossier, { recursive: true, force: true }); });

describe("FichierMailProvider", () => {
  it("écrit le message, lisible par l'e2e", async () => {
    dossier = await mkdtemp(join(tmpdir(), "mail-"));
    const envoye = await new FichierMailProvider(dossier).envoyer({
      a: "lecteur@vito.test", sujet: "Sujet", html: "<p>x</p>", texte: "lien https://x/y",
    });
    expect(envoye).not.toBeNull();
    const [nom] = await readdir(dossier);
    expect(JSON.parse(await readFile(join(dossier, nom!), "utf8"))).toMatchObject({
      a: "lecteur@vito.test", texte: "lien https://x/y",
    });
  });
});
```

Puis, dans `e2e/auth-lien-magique.spec.ts`, remplacer `dernierMessage` et `viderBoite` par une lecture du dossier (`readdir` + `readFile` depuis `node:fs/promises`, tri par nom décroissant), **en conservant toutes les assertions** : l'extraction du lien par la même expression régulière, son ouverture, et l'arrivée sur `/fr/accueil`. Ajouter `.mail-local/` à `.gitignore`.

- [ ] **Step 3 : Brancher le sélecteur**

Dans `src/lib/services/mail/index.ts`, entre Resend et « aucun » :

```ts
  // Issue A :
  if (env.MAIL_MAILPIT_URL && env.MAIL_EXPEDITEUR) {
    return new MailpitMailProvider(env.MAIL_MAILPIT_URL, env.MAIL_EXPEDITEUR);
  }
  // Issue B :
  if (env.MAIL_DOSSIER_LOCAL) return new FichierMailProvider(env.MAIL_DOSSIER_LOCAL);
```

Déclarer la variable retenue dans `src/lib/env.ts` (`z.string().optional()`, `z.string().url().optional()` pour l'URL) et l'ajouter à l'objet passé à `safeParse`, puis à `.env.example` avec sa valeur locale (`MAIL_MAILPIT_URL=http://127.0.0.1:54324` ou `MAIL_DOSSIER_LOCAL=.mail-local`).

**L'ordre compte** : Resend d'abord. La production a une clé Resend et aucune de ces deux variables ; un développeur n'a ni clé Resend ni risque d'envoyer pour de vrai.

- [ ] **Step 4 : La CI**

Dans `.github/workflows/ci.yml`, à la suite des `echo "..." >> "$GITHUB_ENV"` existants :

```bash
          echo "MAIL_EXPEDITEUR=contact@vito.app" >> "$GITHUB_ENV"
          # Issue A :
          echo "MAIL_MAILPIT_URL=$(supabase status -o env | grep '^INBUCKET_URL=' | cut -d= -f2- | tr -d '"')" >> "$GITHUB_ENV"
          # Issue B :
          echo "MAIL_DOSSIER_LOCAL=.mail-local" >> "$GITHUB_ENV"
```

- [ ] **Step 5 : Vérifier**

```bash
npx vitest run src/lib/services/mail/
npm run typecheck && npm run lint
```

- [ ] **Step 6 : Commit**

```bash
git add src/lib/services/mail src/lib/env.ts .env.example .github/workflows/ci.yml
git commit -m "feat(mails): un transport local, pour que l'e2e continue de lire un vrai message"
```

---

### Task 6 : Le lien magique emprunte la voie

**Files:**
- Create: `src/features/auth/data/lienMagique.ts`
- Test: `src/features/auth/data/lienMagique.test.ts`
- Modify: `src/features/auth/data/actions.ts:42-63` (la fonction `envoyerLienMagique`)
- Test (existant, doit rester vert) : `e2e/auth-lien-magique.spec.ts`

**Interfaces:**
- Consumes: `envoyer()` (tâche 3), `createAdminClient()`.
- Produces: `async function envoyerLienMagiqueA(email: string, origine: string): Promise<void>` — ne rend rien et ne jette rien, par construction (voir ci-dessous).

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/features/auth/data/lienMagique.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const generateLink = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink } } }),
}));

const envoyer = vi.fn();
vi.mock("@/lib/mail/envoyer", () => ({ envoyer }));

import { envoyerLienMagiqueA } from "./lienMagique";

beforeEach(() => {
  generateLink.mockReset();
  envoyer.mockReset();
  envoyer.mockResolvedValue({ id: "re_1" });
});

describe("envoyerLienMagiqueA", () => {
  it("envoie un lien qui pointe sur /api/auth/confirm avec le jeton haché", async () => {
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "abc123" }, user: { id: "u-1" } },
      error: null,
    });

    await envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app");

    expect(envoyer).toHaveBeenCalledOnce();
    const arg = envoyer.mock.calls[0]![0];
    expect(arg.genre).toBe("lien_magique");
    expect(arg.a).toBe("lecteur@vito.test");
    expect(arg.userId).toBe("u-1");
    expect(arg.html).toContain("https://vito.app/api/auth/confirm?token_hash=abc123&type=email");
    expect(arg.texte).toContain("https://vito.app/api/auth/confirm?token_hash=abc123&type=email");
  });

  // La règle de sécurité qui existait déjà et qu'il ne faut surtout pas perdre :
  // rien ne doit permettre de savoir si un compte existe.
  it("n'envoie rien et ne jette pas pour une adresse inconnue", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "User not found" } });
    await expect(envoyerLienMagiqueA("inconnu@vito.test", "https://vito.app")).resolves.toBeUndefined();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("ne jette pas si l'envoi échoue", async () => {
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "abc" }, user: { id: "u-1" } },
      error: null,
    });
    envoyer.mockResolvedValue(null);
    await expect(envoyerLienMagiqueA("lecteur@vito.test", "https://vito.app")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx vitest run src/features/auth/data/lienMagique.test.ts
```

Attendu : FAIL, `Cannot find module './lienMagique'`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `src/features/auth/data/lienMagique.ts` :

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { envoyer } from "@/lib/mail/envoyer";
import { log } from "@/lib/log";

// Le lien magique, généré par l'Admin API et envoyé par NOTRE voie — GoTrue
// n'envoie plus rien. C'est ce qui rend traçable le message le plus fréquent de
// la plateforme, celui dont on nous dira qu'il n'arrive pas.
//
// Le corps reste le HTML nu d'aujourd'hui (repris de
// supabase/templates/magic_link.html) : ce lot déplace la voie, le lot 2 lui
// donnera l'allure de Vito.

/**
 * Ne rend RIEN et ne jette JAMAIS — et c'est une règle de sécurité, pas une
 * commodité : l'appelant doit répondre exactement la même chose que le compte
 * existe ou non. Une réponse qui varierait laisserait énumérer les comptes.
 */
export async function envoyerLienMagiqueA(email: string, origine: string): Promise<void> {
  try {
    const admin = createAdminClient();
    // `magiclink` échoue pour une adresse inconnue et ne crée AUCUN compte :
    // c'est l'équivalent de `shouldCreateUser: false`. L'inscription reste sur
    // invitation.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const jeton = data?.properties?.hashed_token;
    if (error || !jeton) {
      // Tracé, jamais montré : compte inconnu, quota atteint, service en panne.
      log.warn("lien_magique", { message: error?.message ?? "aucun jeton" });
      return;
    }

    const lien = `${origine}/api/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=email`;
    await envoyer({
      a: email,
      genre: "lien_magique",
      userId: data?.user?.id,
      sujet: "Votre lien de connexion à Vito",
      html:
        `<h2>Votre lien de connexion</h2>` +
        `<p>Bonjour,</p>` +
        `<p>Ouvrez ce lien pour vous connecter à Vito. Il est valable 15 minutes et ne fonctionne qu'une fois.</p>` +
        `<p><a href="${lien}">Se connecter à Vito</a></p>` +
        `<p>Si vous n'avez pas demandé ce lien, ignorez ce message : personne ne peut accéder à votre carnet sans l'ouvrir.</p>`,
      texte:
        `Votre lien de connexion à Vito.\n\n${lien}\n\n` +
        `Valable 15 minutes, utilisable une seule fois. ` +
        `Si vous n'avez pas demandé ce lien, ignorez ce message.`,
    });
  } catch (err) {
    log.warn("lien_magique", { message: err instanceof Error ? err.message : String(err) });
  }
}
```

- [ ] **Step 4 : Brancher l'action**

Dans `src/features/auth/data/actions.ts`, remplacer le corps de `envoyerLienMagique` après la validation zod. L'ancien bloc :

```ts
  const supabase = await createServerSupabase();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${proto}://${host}/api/auth/confirm` },
  });
  if (error) console.warn("lien_magique", error.message);
  return { envoye: true as const, email: parsed.data.email };
```

devient :

```ts
  // L'origine réelle (le port diffère entre dev, e2e et prod) — le lien doit
  // revenir sur la même instance.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  // Ne rend rien et ne jette rien : la réponse ci-dessous est la MÊME que le
  // compte existe ou non, et c'est ce qui empêche d'énumérer les comptes.
  await envoyerLienMagiqueA(parsed.data.email, `${proto}://${host}`);
  return { envoye: true as const, email: parsed.data.email };
```

Ajouter l'import en tête de fichier :

```ts
import { envoyerLienMagiqueA } from "./lienMagique";
```

Puis retirer `createServerSupabase` de la liste des imports **si et seulement si** plus rien d'autre ne l'utilise dans ce fichier (`grep -n "createServerSupabase" src/features/auth/data/actions.ts`) — `knip` et `eslint` échoueront sinon.

- [ ] **Step 5 : Vérifier l'unitaire et le typage**

```bash
npx vitest run src/features/auth src/lib/mail
npm run typecheck && npm run lint
```

Attendu : tout au vert.

- [ ] **Step 6 : Vérifier de bout en bout**

```bash
supabase start
npm run test:e2e -- e2e/auth-lien-magique.spec.ts
```

Attendu : les trois tests passent, **le transport local de la tâche 5 étant en place**. Ce fichier lit un vrai message, en extrait le lien et l'ouvre : sans la tâche 5, GoTrue n'envoyant plus rien, il échouerait sur « aucun message reçu ».

Si vous avez retenu l'issue B en tâche 5, ce fichier a déjà été adapté là-bas ; ses assertions sont inchangées, seule la source du message diffère.

- [ ] **Step 7 : La suite complète**

```bash
npm run test:e2e
```

Attendu : aucune régression. Les échecs de connexion se voient partout — c'est le test le plus large du lot.

- [ ] **Step 8 : Commit**

```bash
git add src/features/auth/data/lienMagique.ts src/features/auth/data/lienMagique.test.ts src/features/auth/data/actions.ts
git commit -m "feat(mails): le lien magique passe par notre voie, et devient traçable"
```

---

## Après le plan : ce qui reste à faire à la main

Ces trois-là ne sont pas du code, et rien ne fonctionne en production sans elles.

1. **Vérifier `vito.app` chez Resend** — SPF, DKIM, DMARC. Sans quoi tout part en indésirable. Action DNS du PO.
2. **Renseigner `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` et `MAIL_EXPEDITEUR=contact@vito.app`** dans Vercel (production et préversion).
3. **Déclarer l'URL du webhook chez Resend** : `https://<domaine>/api/resend/webhook`, événements `email.delivered`, `email.bounced`, `email.complained`.

Puis la vérification qui ne s'automatise pas : **un vrai envoi en préversion**, et la ligne du journal qui passe de `accepte` à `remis` quand le webhook arrive. C'est la seule preuve que la chaîne tient de bout en bout.
