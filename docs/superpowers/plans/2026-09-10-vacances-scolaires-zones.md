# Vacances scolaires — zones et source officielle · plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que chaque foyer voie les vacances de SA zone, tirées de la source officielle plutôt que d'une liste écrite à la main qui expire à l'été 2027.

**Architecture:** Une table `vacances_scolaires` sert le calendrier à chaque rendu ; l'année absente est récupérée sur l'open data du ministère, normalisée et écrite. Un service sur le patron de `taux-change` (interface, fournisseur, variante « aucun », sélecteur) isole la récupération. La zone du foyer est une colonne de `profiles`, proposée depuis le code postal mais jamais imposée. L'affichage des deux autres zones est une préférence en cookie, lue au rendu serveur.

**Tech Stack:** Next.js (App Router, composants serveur, server actions), Supabase (Postgres, RLS, pgTAP), `fetch` sans SDK, `Intl.DateTimeFormat` pour les fuseaux, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-vacances-scolaires-zones-design.md`

## Global Constraints

- **Aucune dépendance nouvelle.** L'API s'appelle en `fetch` (patron `src/lib/services/taux-change/frankfurter.ts`), les fuseaux se traitent avec `Intl`. La CI (`securite`) fait tourner `knip`, qui doit rester à 0.
- **Code, commentaires et messages en français**, comme tout le dépôt.
- **On n'invente jamais une date.** Pas de calendrier faute de données ⇒ le message existant `voyages.planning.calendrierAbsent`, jamais une extrapolation.
- **Le vocabulaire des zones vient de la source**, pas de nous : `Zone A`, `Zone B`, `Zone C`, `Corse`, `Guadeloupe`, `Guyane`, `Martinique`, `Mayotte`, `Polynésie`, `Réunion`, `Saint Pierre et Miquelon`. Aucune contrainte d'énumération en base.
- **La déduction propose, l'utilisateur dispose** : une zone enregistrée l'emporte toujours sur la déduction.
- **Numéros de migration : commencer à `00063`.** La branche `feat/mails-lot1`, non encore mergée, porte `00061` et `00062`. Vérifier `ls supabase/migrations | tail -3` au moment d'implémenter et décaler si elle a atterri entre-temps.
- **Jamais de total absolu dans un test** (base locale partagée) ; `npm run db:types` après chaque migration.
- **Vérification avant de pousser** : `npm run typecheck && npm run lint && npm run test`.

---

### Task 1 : La table du calendrier

**Files:**
- Create: `supabase/migrations/00063_vacances_scolaires.sql`
- Modify: `supabase/tests/rls_test.sql` (avant `select finish();`)
- Modify: `src/types/database.types.ts` (régénéré)

**Interfaces:**
- Consumes: rien.
- Produces: la table `public.vacances_scolaires`, colonnes `id, annee_scolaire, zone, libelle, debut, fin, recupere_le`, contrainte `unique (annee_scolaire, zone, libelle)`. Utilisée par les tâches 3 et 6.

- [ ] **Step 1 : Écrire la migration**

```sql
-- Calendrier scolaire officiel, mis en cache.
--
-- La liste écrite à la main (vacancesScolaires.ts) ne couvrait qu'une zone et
-- une année, et portait son propre avertissement : « mieux vaut ce silence
-- qu'un calendrier périmé présenté comme vrai ». La source est désormais
-- data.education.gouv.fr, et cette table en est le cache.
--
-- Le cache n'est pas une optimisation, c'est la condition : le planning
-- s'ouvre souvent, et le faire dépendre d'un tiers à chaque rendu
-- contredirait l'habitude du dépôt (AucunTauxProvider, AucunMailProvider).
-- Si l'API tombe, le dernier calendrier connu s'affiche encore.

create table public.vacances_scolaires (
  id             uuid primary key default gen_random_uuid(),
  annee_scolaire text not null,          -- « 2026-2027 »
  -- Tel que la SOURCE le nomme : « Zone A », mais aussi « Corse », « Réunion »…
  -- Pas de contrainte d'énumération : le vocabulaire ne nous appartient pas, et
  -- une valeur inconnue affichée telle quelle vaut mieux qu'une migration à
  -- chaque évolution du jeu de données.
  zone           text not null,
  libelle        text not null,          -- « Vacances de Noël »
  -- Dates de PARIS, déjà converties (la source publie minuit de Paris exprimé
  -- en UTC : 2026-12-18T23:00:00Z est le 19 décembre).
  debut          date not null,
  fin            date not null,
  recupere_le    timestamptz not null default now(),
  unique (annee_scolaire, zone, libelle)
);

create index vacances_scolaires_zone_idx on public.vacances_scolaires (zone, debut);

alter table public.vacances_scolaires enable row level security;

-- Données publiques, mais l'écran qui les affiche est derrière la connexion.
-- L'écriture appartient au serveur : le rafraîchissement passe par le rôle de
-- service, qui contourne la RLS.
create policy "vacances_scolaires_select" on public.vacances_scolaires
  for select to authenticated using (true);

revoke all on public.vacances_scolaires from anon;
grant select on public.vacances_scolaires to authenticated;
revoke insert, update, delete on public.vacances_scolaires from authenticated;
```

**Note :** contrairement aux journaux (`journal_acces`, `journal_envois`), ce n'est PAS une table append-only. Une ligne fausse doit pouvoir être recalculée — d'où l'absence de commentaire « append-only » et la présence d'un `unique` qui permettra un `upsert`.

- [ ] **Step 2 : Écrire les tests pgTAP**

Dans `supabase/tests/rls_test.sql`, avant `select finish();` :

```sql
-- ── Calendrier scolaire (00063) ─────────────────────────────────────────────
select has_table('public', 'vacances_scolaires', 'la table du calendrier scolaire existe');

insert into public.vacances_scolaires (annee_scolaire, zone, libelle, debut, fin)
values ('2026-2027', 'Zone C', 'pgtap Noël', '2026-12-19', '2027-01-04');

-- Données publiques pour qui est connecté : tout le monde lit le même calendrier.
select is(tests.count_as('11111111-1111-1111-1111-111111111111',
  'select count(*) from public.vacances_scolaires where libelle = ''pgtap Noël'''),
  1::bigint, 'un compte connecté lit le calendrier');

-- anon ne voit rien : l'écran qui l'affiche est derrière la connexion.
select is(tests.count_as_anon('select count(*) from public.vacances_scolaires'),
  0::bigint, 'anon ne lit rien du calendrier');

-- Le calendrier ne s'écrit pas depuis le navigateur : il vient de la source.
select throws_ok(
  $$ insert into public.vacances_scolaires (annee_scolaire, zone, libelle, debut, fin)
     values ('2026-2027', 'Zone A', 'pgtap faux', '2026-01-01', '2026-01-02') $$,
  '42501', null, 'un compte connecté n''écrit pas dans le calendrier');
```

**Attention :** le `throws_ok` doit matcher le **SQLSTATE `42501`**, pas le texte du message — la formulation de Postgres change selon la version. C'est le précédent de `journal_acces` (`rls_test.sql`, test de refus de suppression), et une leçon déjà payée sur ce dépôt.

Le `plan(N)` en tête de fichier augmente de 4.

- [ ] **Step 3 : Voir le rouge**

Renommer temporairement la migration en `.sql.off`, puis :

```bash
supabase db reset && npm run test:rls
```

Attendu : échec sur `has_table`. (`db reset` est obligatoire : un passage e2e contamine la base locale.)

- [ ] **Step 4 : Voir le vert**

Rendre son nom `.sql` à la migration, puis :

```bash
supabase db reset && npm run test:rls
```

Attendu : les 4 nouvelles assertions passent, aucune existante ne casse.

- [ ] **Step 5 : Régénérer les types**

```bash
npm run db:types && npm run typecheck
```

- [ ] **Step 6 : Commit**

```bash
git add supabase/migrations/00063_vacances_scolaires.sql supabase/tests/rls_test.sql src/types/database.types.ts
git commit -m "feat(voyages): la table du calendrier scolaire, cache de la source officielle"
```

---

### Task 2 : Le service open data, et ses trois pièges

**Files:**
- Create: `src/lib/services/vacances/types.ts`
- Create: `src/lib/services/vacances/educationGouv.ts`
- Create: `src/lib/services/vacances/aucun.ts`
- Create: `src/lib/services/vacances/index.ts`
- Test: `src/lib/services/vacances/educationGouv.test.ts`

**Interfaces:**
- Consumes: rien (le service ne connaît ni la base ni Next).
- Produces :
  - `type PeriodeVacances = { anneeScolaire: string; zone: string; libelle: string; debut: string; fin: string }` (dates `YYYY-MM-DD`, heure de Paris)
  - `interface VacancesProvider { readonly name: string; recuperer(anneeScolaire: string): Promise<PeriodeVacances[] | null> }`
  - `function normaliser(records: unknown): PeriodeVacances[]` (exportée pour le test)
  - `function getVacancesProvider(): VacancesProvider`
  Utilisés par la tâche 3.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/lib/services/vacances/educationGouv.test.ts`. **La fixture est une vraie réponse de l'API, capturée le 10 septembre 2026** — elle exerce les trois pièges à la fois :

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { EducationGouvProvider, normaliser } from "./educationGouv";

// Capturé sur l'API réelle. Ne pas « simplifier » : chaque ligne est là pour
// un piège précis.
const REPONSE = {
  total_count: 6,
  results: [
    // Minuit à PARIS, exprimé en UTC : c'est le 19 décembre, pas le 18.
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone A", population: "-",
      location: "Besançon", annee_scolaire: "2026-2027" },
    // Trois académies pour la MÊME période de la zone B : une seule doit sortir.
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone B", population: "-",
      location: "Aix-Marseille", annee_scolaire: "2026-2027" },
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone B", population: "-",
      location: "Amiens", annee_scolaire: "2026-2027" },
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone B", population: "-",
      location: "Strasbourg", annee_scolaire: "2026-2027" },
    { description: "Vacances de Noël", start_date: "2026-12-18T23:00:00+00:00",
      end_date: "2027-01-03T23:00:00+00:00", zones: "Zone C", population: "-",
      location: "Paris", annee_scolaire: "2026-2027" },
    // Réservée aux enseignants : ne doit JAMAIS être annoncée à une famille.
    { description: "Vacances d'Été", start_date: "2027-07-09T22:00:00+00:00",
      end_date: "2027-08-31T22:00:00+00:00", zones: "Mayotte",
      population: "Enseignants", location: "Mayotte", annee_scolaire: "2026-2027" },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("normaliser", () => {
  it("convertit en date de PARIS : Noël commence le 19, pas le 18", () => {
    const noelA = normaliser(REPONSE).find((p) => p.zone === "Zone A");
    expect(noelA).toMatchObject({ debut: "2026-12-19", fin: "2027-01-04" });
  });

  it("déduplique les académies : une seule période par zone", () => {
    const zoneB = normaliser(REPONSE).filter((p) => p.zone === "Zone B");
    expect(zoneB).toHaveLength(1);
  });

  it("écarte ce qui ne concerne que les enseignants", () => {
    expect(normaliser(REPONSE).some((p) => p.zone === "Mayotte")).toBe(false);
  });

  it("garde le vocabulaire de la source, sans le réduire à A/B/C", () => {
    const zones = new Set(normaliser(REPONSE).map((p) => p.zone));
    expect(zones).toEqual(new Set(["Zone A", "Zone B", "Zone C"]));
  });

  it("ne jette pas sur une réponse difforme, elle rend une liste vide", () => {
    expect(normaliser(null)).toEqual([]);
    expect(normaliser({ results: [{ description: "x" }] })).toEqual([]);
  });
});

describe("EducationGouvProvider", () => {
  const provider = new EducationGouvProvider();

  it("demande l'année scolaire voulue et rend les périodes normalisées", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => REPONSE } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const periodes = await provider.recuperer("2026-2027");
    expect(periodes?.length).toBe(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("2026-2027");
  });

  it("rend null plutôt que de jeter quand la source refuse ou tombe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response));
    expect(await provider.recuperer("2026-2027")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(await provider.recuperer("2026-2027")).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx vitest run src/lib/services/vacances/
```

Attendu : FAIL, `Cannot find module './educationGouv'`.

- [ ] **Step 3 : Écrire les types**

`src/lib/services/vacances/types.ts` :

```ts
export type PeriodeVacances = {
  /** « 2026-2027 » */
  anneeScolaire: string;
  /** Tel que la source le nomme : « Zone A », « Corse », « Réunion »… */
  zone: string;
  /** « Vacances de Noël » */
  libelle: string;
  /** `YYYY-MM-DD`, heure de PARIS — jamais la date UTC brute de la source. */
  debut: string;
  fin: string;
};

export interface VacancesProvider {
  readonly name: string;
  /**
   * `null` quand l'année n'a pas pu être récupérée, quelle qu'en soit la
   * raison. Ne jette jamais : un calendrier absent dégrade un écran, il ne
   * doit pas le casser.
   */
  recuperer(anneeScolaire: string): Promise<PeriodeVacances[] | null>;
}
```

- [ ] **Step 4 : Écrire le fournisseur et sa normalisation**

`src/lib/services/vacances/educationGouv.ts` :

```ts
import { log, errorContext } from "@/lib/log";
import type { PeriodeVacances, VacancesProvider } from "./types";

const BASE =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

// Le jeu publie une ligne par ACADÉMIE : ~200 pour une année scolaire.
const LIMITE = 200;

/**
 * Date de Paris à partir de l'horodatage de la source.
 *
 * Le piège : `2026-12-18T23:00:00+00:00` est minuit le 19 à Paris. Tronquer la
 * chaîne donnerait le 18 — un jour de vacances effacé, et un départ planifié un
 * jour d'école. `fr-CA` est choisi pour une seule raison : c'est la locale dont
 * le format court est déjà `YYYY-MM-DD`.
 */
export function dateDeParis(horodatage: string): string | null {
  const t = Date.parse(horodatage);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(t));
}

type Brut = {
  description?: unknown; start_date?: unknown; end_date?: unknown;
  zones?: unknown; population?: unknown; annee_scolaire?: unknown;
};

/**
 * Trois filtres, trois pièges — aucun ne se devine, tous ont été relevés dans
 * la vraie réponse :
 *  1. les dates sont à minuit de Paris exprimé en UTC ;
 *  2. il y a une ligne par académie, donc jusqu'à onze doublons par période ;
 *  3. `population` vaut parfois « Enseignants » : ces dates ne concernent pas
 *     les familles et ne doivent jamais leur être annoncées.
 */
export function normaliser(reponse: unknown): PeriodeVacances[] {
  const results = (reponse as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];

  const parCle = new Map<string, PeriodeVacances>();
  for (const brut of results as Brut[]) {
    const population = typeof brut.population === "string" ? brut.population : "";
    if (population === "Enseignants") continue;

    const zone = typeof brut.zones === "string" ? brut.zones : "";
    const libelle = typeof brut.description === "string" ? brut.description : "";
    const anneeScolaire = typeof brut.annee_scolaire === "string" ? brut.annee_scolaire : "";
    const debut = typeof brut.start_date === "string" ? dateDeParis(brut.start_date) : null;
    const fin = typeof brut.end_date === "string" ? dateDeParis(brut.end_date) : null;
    if (!zone || !libelle || !anneeScolaire || !debut || !fin) continue;

    // La clé porte la zone et le libellé, pas l'académie : c'est elle qui
    // écrase les doublons.
    parCle.set(`${anneeScolaire}|${zone}|${libelle}`, { anneeScolaire, zone, libelle, debut, fin });
  }
  return [...parCle.values()];
}

export class EducationGouvProvider implements VacancesProvider {
  readonly name = "education-gouv";

  async recuperer(anneeScolaire: string): Promise<PeriodeVacances[] | null> {
    const url =
      `${BASE}?where=annee_scolaire%3D%22${encodeURIComponent(anneeScolaire)}%22` +
      `&limit=${LIMITE}&select=description,start_date,end_date,zones,population,annee_scolaire`;
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) {
        log.warn("vacances_refus", { statut: reponse.status, anneeScolaire });
        return null;
      }
      return normaliser(await reponse.json());
    } catch (err) {
      log.warn("vacances_injoignable", { anneeScolaire, ...errorContext(err) });
      return null;
    }
  }
}
```

- [ ] **Step 5 : Écrire la variante « aucun » et le sélecteur**

`src/lib/services/vacances/aucun.ts` :

```ts
import type { PeriodeVacances, VacancesProvider } from "./types";

// Aucune source configurée : on ne rend rien, et l'écran le dira. Inventer un
// calendrier plausible serait pire que de n'en afficher aucun — on planifie des
// voyages dessus.
export class AucunVacancesProvider implements VacancesProvider {
  readonly name = "aucun";
  async recuperer(): Promise<PeriodeVacances[] | null> {
    return null;
  }
}
```

`src/lib/services/vacances/index.ts` :

```ts
import { EducationGouvProvider } from "./educationGouv";
import type { VacancesProvider } from "./types";

// Pas de variable d'environnement : la source est publique, sans clé, et son
// URL ne change pas. `AucunVacancesProvider` existe pour les tests qui veulent
// une source muette, pas pour une configuration.
export function getVacancesProvider(): VacancesProvider {
  return new EducationGouvProvider();
}

export { AucunVacancesProvider } from "./aucun";
export type { PeriodeVacances, VacancesProvider } from "./types";
```

- [ ] **Step 6 : Vérifier le vert**

```bash
npx vitest run src/lib/services/vacances/
npm run typecheck && npm run lint && npm run knip
```

Attendu : 7 tests au vert, knip à 0.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/services/vacances
git commit -m "feat(voyages): la source officielle des vacances, et ses trois pièges"
```

---

### Task 3 : `getVacances`, le cache qui sert toujours

**Files:**
- Create: `src/features/voyages/data/vacances.ts`
- Test: `src/features/voyages/data/vacances.test.ts`

**Interfaces:**
- Consumes: `getVacancesProvider()`, `PeriodeVacances` (tâche 2) ; la table `vacances_scolaires` (tâche 1) ; `createAdminClient()` de `@/lib/supabase/admin` ; `createServerSupabase()` de `@/lib/supabase/server` ; le type `Periode` de `@/features/voyages/domain/planning` (`{ id, libelle, debut, fin }`).
- Produces :
  - `function anneesScolairesDe(debut: string, fin: string): string[]` (exportée, testable)
  - `async function getVacances(zone: string, debut: string, fin: string): Promise<Periode[]>`
  Utilisée par la tâche 6.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const recuperer = vi.fn();
vi.mock("@/lib/services/vacances", () => ({
  getVacancesProvider: () => ({ name: "faux", recuperer }),
}));

// Base en mémoire : les lignes que la table contiendrait.
let lignes: { annee_scolaire: string; zone: string; libelle: string; debut: string; fin: string }[] = [];
const upserts: unknown[][] = [];
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, zone: string) => ({
          in: (_c2: string, annees: string[]) => ({
            order: async () => ({
              data: lignes.filter((l) => l.zone === zone && annees.includes(l.annee_scolaire)),
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: async (rows: unknown[]) => { upserts.push(rows); return { error: null }; },
    }),
  }),
}));

import { getVacances, anneesScolairesDe } from "./vacances";

beforeEach(() => { lignes = []; upserts.length = 0; recuperer.mockReset(); });

describe("anneesScolairesDe", () => {
  // L'année scolaire bascule au 1er septembre : une fenêtre de douze mois
  // ouverte en janvier chevauche donc deux années.
  it("rend l'année qui couvre une fenêtre interne", () => {
    expect(anneesScolairesDe("2026-10-01", "2027-06-30")).toEqual(["2026-2027"]);
  });
  it("rend les deux années d'une fenêtre à cheval sur septembre", () => {
    expect(anneesScolairesDe("2027-06-01", "2028-05-31")).toEqual(["2026-2027", "2027-2028"]);
  });
});

describe("getVacances", () => {
  it("sert le cache sans appeler la source quand l'année est là", async () => {
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    const periodes = await getVacances("Zone C", "2026-10-01", "2027-06-30");
    expect(periodes).toEqual([{ id: "2026-2027|Zone C|Noël", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }]);
    expect(recuperer).not.toHaveBeenCalled();
  });

  it("récupère et écrit l'année absente, puis la sert", async () => {
    recuperer.mockImplementation(async () => {
      lignes.push({ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" });
      return [{ anneeScolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    });
    const periodes = await getVacances("Zone C", "2026-10-01", "2027-06-30");
    expect(recuperer).toHaveBeenCalledWith("2026-2027");
    expect(upserts[0]).toHaveLength(1);
    expect(periodes).toHaveLength(1);
  });

  // Le point de tout le dispositif : une source absente ne vide pas l'écran.
  it("sert le cache même quand la source est injoignable", async () => {
    lignes = [{ annee_scolaire: "2026-2027", zone: "Zone C", libelle: "Noël", debut: "2026-12-19", fin: "2027-01-04" }];
    recuperer.mockResolvedValue(null);
    expect(await getVacances("Zone C", "2026-06-01", "2027-05-31")).toHaveLength(1);
  });

  it("rend une liste vide, sans jeter, quand il n'y a ni cache ni source", async () => {
    recuperer.mockResolvedValue(null);
    await expect(getVacances("Zone C", "2026-10-01", "2027-06-30")).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx vitest run src/features/voyages/data/vacances.test.ts
```

Attendu : FAIL, module introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

```ts
import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVacancesProvider } from "@/lib/services/vacances";
import { log } from "@/lib/log";
import type { Periode } from "../domain/planning";

/**
 * Années scolaires couvrant une fenêtre. L'année bascule au 1er septembre :
 * une fenêtre de douze mois ouverte en janvier en chevauche donc deux, et
 * n'en récupérer qu'une laisserait un trou au milieu de la frise.
 */
export function anneesScolairesDe(debut: string, fin: string): string[] {
  const annee = (d: string) => {
    const [a, m] = [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
    const premiere = m >= 9 ? a : a - 1;
    return `${premiere}-${premiere + 1}`;
  };
  const [a, b] = [annee(debut), annee(fin)];
  if (a === b) return [a];
  const out: string[] = [];
  for (let y = Number(a.slice(0, 4)); y <= Number(b.slice(0, 4)); y++) out.push(`${y}-${y + 1}`);
  return out;
}

async function lire(zone: string, annees: string[]) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("vacances_scolaires")
    .select("annee_scolaire, zone, libelle, debut, fin")
    .eq("zone", zone)
    .in("annee_scolaire", annees)
    .order("debut");
  if (error) {
    log.warn("vacances_lecture", { message: error.message });
    return [];
  }
  return data ?? [];
}

/**
 * Le calendrier d'une zone sur une fenêtre. Sert TOUJOURS ce que la table
 * contient ; ne va chercher que l'année absente.
 *
 * On ne rafraîchit jamais ce qu'on a déjà : la règle est volontairement bête,
 * et sa conséquence est assumée — une date corrigée après coup par le
 * ministère reste l'ancienne, et le remède est de supprimer les lignes de
 * l'année. Une politique de fraîcheur coûterait un réglage et une tempête de
 * requêtes à chaque rentrée, pour un problème rare.
 *
 * Ne jette jamais : un calendrier absent dégrade l'écran, il ne le casse pas.
 */
export async function getVacances(zone: string, debut: string, fin: string): Promise<Periode[]> {
  const annees = anneesScolairesDe(debut, fin);
  let lignes = await lire(zone, annees);

  const presentes = new Set(lignes.map((l) => l.annee_scolaire));
  const manquantes = annees.filter((a) => !presentes.has(a));

  if (manquantes.length > 0) {
    const provider = getVacancesProvider();
    for (const annee of manquantes) {
      const periodes = await provider.recuperer(annee);
      if (!periodes || periodes.length === 0) continue;
      const { error } = await createAdminClient()
        .from("vacances_scolaires")
        .upsert(
          periodes.map((p) => ({
            annee_scolaire: p.anneeScolaire, zone: p.zone,
            libelle: p.libelle, debut: p.debut, fin: p.fin,
          })),
          { onConflict: "annee_scolaire,zone,libelle" },
        );
      if (error) log.warn("vacances_ecriture", { annee, message: error.message });
    }
    lignes = await lire(zone, annees);
  }

  return lignes.map((l) => ({
    // Identifiant stable et lisible : la clé unique de la table.
    id: `${l.annee_scolaire}|${l.zone}|${l.libelle}`,
    libelle: l.libelle,
    debut: l.debut,
    fin: l.fin,
  }));
}
```

- [ ] **Step 4 : Vérifier le vert**

```bash
npx vitest run src/features/voyages/data/
npm run typecheck && npm run lint
```

Attendu : 6 tests au vert.

- [ ] **Step 5 : Commit**

```bash
git add src/features/voyages/data/vacances.ts src/features/voyages/data/vacances.test.ts
git commit -m "feat(voyages): getVacances, un cache qui sert même quand la source tombe"
```

---

### Task 4 : La zone du foyer, déduite mais jamais imposée

**Files:**
- Create: `supabase/migrations/00064_profil_zone_scolaire.sql`
- Create: `src/features/voyages/domain/zoneScolaire.ts`
- Test: `src/features/voyages/domain/zoneScolaire.test.ts`
- Modify: `src/types/database.types.ts` (régénéré)

**Interfaces:**
- Consumes: rien.
- Produces :
  - colonne `profiles.zone_scolaire text` (nullable, sans énumération)
  - `const ZONES: readonly string[]` — les onze valeurs de la source
  - `function deduireZone(adresse: string | null | undefined): string | null`
  Utilisés par les tâches 5 et 6.

- [ ] **Step 1 : Écrire la migration**

```sql
-- Zone de vacances du foyer.
--
-- Nullable et SANS contrainte d'énumération : le vocabulaire vient de la source
-- (« Zone A », mais aussi « Corse », « Réunion »…), et il ne nous appartient
-- pas. Une valeur inconnue affichée telle quelle vaut mieux qu'une migration à
-- chaque évolution du jeu de données du ministère.
--
-- Null = jamais choisie. L'écran propose alors la zone déduite de l'adresse du
-- foyer, sans l'enregistrer : déduire n'est pas décider.
alter table public.profiles add column zone_scolaire text;
```

Aucune policy à ajouter : `profiles` a déjà les siennes, et une colonne suit sa table.

- [ ] **Step 2 : Écrire le test qui échoue**

```ts
import { describe, it, expect } from "vitest";
import { deduireZone, ZONES } from "./zoneScolaire";

describe("ZONES", () => {
  it("porte le vocabulaire de la source, pas un A/B/C réducteur", () => {
    expect(ZONES).toContain("Zone A");
    expect(ZONES).toContain("Corse");
    expect(ZONES).toContain("Réunion");
    expect(ZONES).toHaveLength(11);
  });
});

describe("deduireZone", () => {
  // Ancres vérifiées contre la source : l'API donne académie → zone, et ces
  // départements → académie ne souffrent aucune ambiguïté.
  it.each([
    ["12 rue de Rivoli, 75001 Paris", "Zone C"],
    ["8 quai Saint-Antoine, 69002 Lyon", "Zone A"],
    ["3 La Canebière, 13001 Marseille", "Zone B"],
    ["5 place du Capitole, 31000 Toulouse", "Zone C"],
    ["2 cours de l'Intendance, 33000 Bordeaux", "Zone A"],
    ["1 rue Faidherbe, 59000 Lille", "Zone B"],
    ["4 rue Crébillon, 44000 Nantes", "Zone B"],
    ["7 avenue de la Mer, 34000 Montpellier", "Zone C"],
    ["1 cours Napoléon, 20000 Ajaccio", "Corse"],
    ["10 rue de Paris, 97400 Saint-Denis", "Réunion"],
  ])("déduit %s → %s", (adresse, attendu) => {
    expect(deduireZone(adresse)).toBe(attendu);
  });

  it("rend null quand elle ne sait pas, plutôt qu'une zone plausible", () => {
    expect(deduireZone("chez ma sœur, en face de la boulangerie")).toBeNull();
    expect(deduireZone("")).toBeNull();
    expect(deduireZone(null)).toBeNull();
    expect(deduireZone("99999 Nulle-Part")).toBeNull();
  });
});
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

```bash
npx vitest run src/features/voyages/domain/zoneScolaire.test.ts
```

Attendu : FAIL, module introuvable.

- [ ] **Step 4 : Écrire le module**

Créer `src/features/voyages/domain/zoneScolaire.ts`.

**La table a été construite et vérifiée le 10 septembre 2026**, par jointure de
deux jeux du même portail — rien n'est écrit de mémoire :

- `fr-en-calendrier-scolaire`, `group_by=location,zones` → académie → zone ;
- `fr-en-annuaire-education`, `group_by=code_departement,libelle_academie` →
  département → académie (107 départements, 34 académies).

**Deux pièges découverts à la jointure, à ne pas reperdre :**

1. **Les deux jeux ne nomment pas les académies pareil.** Le calendrier dit
   `Réunion` et `Polynésie` ; l'annuaire dit `La Réunion` et
   `Polynésie Française`. Sans alignement explicite, quatre territoires
   tombaient dans le trou.
2. **Wallis-et-Futuna (986) et la Nouvelle-Calédonie (988) n'ont aucune ligne
   dans le calendrier.** Ils n'ont donc pas de zone : `deduireZone` doit y
   rendre `null`, et l'écran demandera. Les inventer serait exactement la faute
   que ce chantier corrige.

Le résultat, 105 départements, à recopier tel quel :

```ts
// Zone de vacances d'une adresse.
//
// Deux moitiés, deux sources : académie → zone vient de l'API du calendrier
// elle-même (champ `location` regroupé par `zones`, relevé le 2026-09-10) ;
// département → académie est transcrit depuis fr-en-annuaire-education
// (requête citée ci-dessous). Aucune n'est écrite de mémoire — dix ancres les
// vérifient dans le test.

/** Les onze valeurs que la source emploie. L'ordre est celui de l'écran. */
export const ZONES = [
  "Zone A", "Zone B", "Zone C", "Corse",
  "Guadeloupe", "Guyane", "Martinique", "Mayotte",
  "Polynésie", "Réunion", "Saint Pierre et Miquelon",
] as const;

/**
 * Département → zone. Construit par jointure des deux jeux du ministère le
 * 2026-09-10 (requêtes citées en tête de fichier), pas de mémoire.
 *
 * Absents volontairement : 986 (Wallis-et-Futuna) et 988 (Nouvelle-Calédonie),
 * qui n'ont aucune ligne dans le calendrier — on rend `null` plutôt qu'une
 * zone inventée.
 */
const ZONE_PAR_DEPARTEMENT: Record<string, string> = Object.fromEntries([
  ...["01","03","07","15","16","17","19","21","23","24","25","26","33","38","39","40","42",
      "43","47","58","63","64","69","70","71","73","74","79","86","87","89","90"].map((d) => [d, "Zone A"]),
  ...["02","04","05","06","08","10","13","14","18","22","27","28","29","35","36","37","41",
      "44","45","49","50","51","52","53","54","55","56","57","59","60","61","62","67","68",
      "72","76","80","83","84","85","88"].map((d) => [d, "Zone B"]),
  ...["09","11","12","30","31","32","34","46","48","65","66","75","77","78","81","82","91",
      "92","93","94","95"].map((d) => [d, "Zone C"]),
  ["2A", "Corse"], ["2B", "Corse"],
  ["971", "Guadeloupe"], ["977", "Guadeloupe"], ["978", "Guadeloupe"],
  ["972", "Martinique"], ["973", "Guyane"], ["974", "Réunion"],
  ["975", "Saint Pierre et Miquelon"], ["976", "Mayotte"], ["987", "Polynésie"],
]);

/**
 * Zone déduite de l'adresse libre du foyer, ou `null`.
 *
 * `null` n'est pas un échec : c'est le cas « je ne sais pas », et l'écran
 * demande alors plutôt que de deviner. Une zone fausse enverrait planifier un
 * départ un jour d'école.
 */
export function deduireZone(adresse: string | null | undefined): string | null {
  if (!adresse) return null;
  // Un code postal français : cinq chiffres isolés. La Corse s'écrit 20xxx en
  // code postal et 2A/2B en département — la conversion est dans la table.
  const m = /\b(\d{5})\b/.exec(adresse);
  if (!m) return null;
  const cp = m[1]!;
  // La Corse s'écrit 20xxx en code POSTAL mais 2A/2B en DÉPARTEMENT. Les deux
  // partagent la même zone, donc la distinction Corse-du-Sud / Haute-Corse est
  // sans objet ici — d'où le raccourci, écrit plutôt que sous-entendu.
  if (cp.startsWith("20")) return "Corse";
  // Outre-mer : trois chiffres (971…978, 984…988). Métropole : deux.
  const departement = cp.startsWith("97") || cp.startsWith("98") ? cp.slice(0, 3) : cp.slice(0, 2);
  return ZONE_PAR_DEPARTEMENT[departement] ?? null;
}
```

**Le cas corse est le seul où le code postal et le code département divergent** — et c'est précisément pourquoi il est traité en clair dans la fonction plutôt que par une entrée `"20"` dans la table, qui aurait laissé croire que `20` est un département.

- [ ] **Step 5 : Vérifier le vert et régénérer les types**

```bash
npx vitest run src/features/voyages/domain/zoneScolaire.test.ts
supabase db reset && npm run db:types
npm run typecheck && npm run lint
```

Attendu : 12 tests au vert, `zone_scolaire` visible dans les types.

- [ ] **Step 6 : Commit**

```bash
git add supabase/migrations/00064_profil_zone_scolaire.sql src/features/voyages/domain/zoneScolaire.ts src/features/voyages/domain/zoneScolaire.test.ts src/types/database.types.ts
git commit -m "feat(voyages): la zone du foyer, déduite du code postal sans être imposée"
```

---

### Task 5 : La section de réglages

**Files:**
- Create: `src/features/voyages/ui/ZoneScolaireSection.tsx`
- Create: `src/features/voyages/data/actionsZone.ts`
- Test: `src/features/voyages/data/actionsZone.test.ts`
- Modify: `src/app/[locale]/(app)/reglages/page.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json`, `messages/it.json`

**Interfaces:**
- Consumes: `ZONES`, `deduireZone` (tâche 4).
- Produces: `async function enregistrerZoneScolaire(_prev: unknown, formData: FormData): Promise<{ ok: true } | { error: string }>`. Rien d'autre ne la consomme.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser },
    from: () => ({ update: (v: unknown) => { update(v); return { eq: async () => ({ error: null }) }; } }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { enregistrerZoneScolaire } from "./actionsZone";

const formulaire = (zone: string) => {
  const f = new FormData();
  f.set("zone", zone);
  return f;
};

beforeEach(() => {
  update.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
});

describe("enregistrerZoneScolaire", () => {
  it("enregistre une zone du vocabulaire de la source", async () => {
    expect(await enregistrerZoneScolaire(undefined, formulaire("Zone C"))).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ zone_scolaire: "Zone C" });
  });

  it("accepte les territoires, pas seulement A/B/C", async () => {
    await enregistrerZoneScolaire(undefined, formulaire("Réunion"));
    expect(update).toHaveBeenCalledWith({ zone_scolaire: "Réunion" });
  });

  // Une valeur libre viendrait d'un formulaire trafiqué : elle salirait la
  // colonne et ne correspondrait à aucune ligne du calendrier.
  it("refuse une zone hors vocabulaire, sans écrire", async () => {
    const r = await enregistrerZoneScolaire(undefined, formulaire("Zone Z"));
    expect(r).toHaveProperty("error");
    expect(update).not.toHaveBeenCalled();
  });

  it("refuse sans session, sans écrire", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const r = await enregistrerZoneScolaire(undefined, formulaire("Zone C"));
    expect(r).toHaveProperty("error");
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx vitest run src/features/voyages/data/actionsZone.test.ts
```

- [ ] **Step 3 : Écrire l'action**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { logActionError } from "@/lib/actionError";
import { ZONES } from "../domain/zoneScolaire";

/**
 * Enregistre la zone choisie. Elle l'emporte définitivement sur la déduction :
 * déménager ne doit pas changer sa zone dans le dos de l'utilisateur.
 */
export async function enregistrerZoneScolaire(_prev: unknown, formData: FormData) {
  const zone = String(formData.get("zone") ?? "");
  // Le vocabulaire vient de la source : une valeur hors liste ne correspondrait
  // à aucune ligne du calendrier, et n'a pu venir que d'un formulaire trafiqué.
  if (!(ZONES as readonly string[]).includes(zone)) return { error: "zone inconnue" };

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "non authentifié" };

  const { error } = await supabase.from("profiles").update({ zone_scolaire: zone }).eq("id", data.user.id);
  if (error) {
    logActionError("zone_scolaire.update", error);
    return { error: "enregistrement impossible" };
  }
  revalidatePath("/voyages/planning");
  return { ok: true as const };
}
```

- [ ] **Step 4 : Écrire la section**

`src/features/voyages/ui/ZoneScolaireSection.tsx`, composant **client**, sur le patron des autres sections de réglages (`src/features/compte/ui/DonneesSection.tsx` : `"use client"`, `useActionState`, `useTranslations`, bouton `@/features/shared/ui/Button`) :

- un `<select name="zone">` listant `ZONES`, valeur courante `zoneEnregistree ?? zoneDeduite ?? ""` ;
- quand `zoneEnregistree` est nulle et `zoneDeduite` non nulle, une mention sous le champ : `t("zone.deduite", { zone: zoneDeduite })` → « Zone C, déduite de votre adresse. Confirmez ou changez. » ;
- quand les deux sont nulles : `t("zone.inconnue")` → « Nous n'avons pas pu déduire votre zone. Choisissez-la pour voir les vacances sur le planning. » ;
- `data-testid="zone-scolaire-select"` et `data-testid="zone-scolaire-enregistrer"` pour l'e2e.

Props : `{ zoneEnregistree: string | null; zoneDeduite: string | null }`.

- [ ] **Step 5 : Brancher dans les réglages**

Dans `src/app/[locale]/(app)/reglages/page.tsx`, lire `profiles.zone_scolaire` et l'adresse de la fiche « Moi » (`family_members.address` du membre `relation = 'moi'`), puis, sous une nouvelle `<SectionLabel>{t("sections.vacances")}</SectionLabel>` :

```tsx
<ZoneScolaireSection
  zoneEnregistree={profil?.zone_scolaire ?? null}
  zoneDeduite={deduireZone(moi?.address)}
/>
```

- [ ] **Step 6 : Les quatre langues**

Ajouter dans `messages/{fr,en,es,it}.json`, sous `voyages`, un bloc `zone` : `titre`, `deduite` (avec le paramètre `{zone}`), `inconnue`, `enregistrer`, `enregistree`. Plus `compte.sections.vacances`. Le test `src/lib/i18n/messages-parity.test.ts` échouera si une langue manque une clé — c'est le filet.

- [ ] **Step 7 : Vérifier**

```bash
npx vitest run
npm run typecheck && npm run lint && npm run knip
```

- [ ] **Step 8 : Commit**

```bash
git add src/features/voyages/ui/ZoneScolaireSection.tsx src/features/voyages/data/actionsZone.ts src/features/voyages/data/actionsZone.test.ts "src/app/[locale]/(app)/reglages/page.tsx" messages
git commit -m "feat(voyages): choisir sa zone de vacances dans les réglages"
```

---

### Task 6 : Le planning recâblé, et l'interrupteur

**Files:**
- Modify: `src/app/[locale]/(app)/voyages/planning/page.tsx`
- Modify: `src/features/voyages/ui/PlanningFrise.tsx`
- Modify: `src/features/voyages/ui/PlanningCalendrier.tsx`
- Create: `src/features/voyages/ui/AutresZonesInterrupteur.tsx`
- Delete: `src/features/voyages/data/vacancesScolaires.ts`, `src/features/voyages/data/vacancesScolaires.test.ts`
- Modify: `e2e/voyages.spec.ts` (ou un nouveau `e2e/vacances-zones.spec.ts`)
- Modify: `messages/{fr,en,es,it}.json`

**Interfaces:**
- Consumes: `getVacances(zone, debut, fin)` (tâche 3), `deduireZone`, `ZONES` (tâche 4), `profiles.zone_scolaire`.
- Produces: rien pour la suite — c'est la dernière tâche.

- [ ] **Step 1 : Le cookie**

L'interrupteur est une préférence d'affichage lue au **rendu serveur** : un `localStorage` ferait apparaître les bandes après l'hydratation, avec un clignotement à chaque ouverture. Le thème utilise déjà un cookie lu dans le layout (`src/app/[locale]/layout.tsx`) — même mécanisme.

`AutresZonesInterrupteur.tsx`, composant client : une case à cocher qui écrit `document.cookie = "zones_autres=1; path=/; max-age=31536000"` (ou `max-age=0` pour l'effacer) puis appelle `router.refresh()`. `data-testid="autres-zones"`.

- [ ] **Step 2 : La page**

Dans `planning/page.tsx`, remplacer les imports de `VACANCES_ZONE_C` / `ZONE_SCOLAIRE` par :

```tsx
const zone = profil?.zone_scolaire ?? deduireZone(moi?.address);

// La MÊME fenêtre que la frise, tirée de la même fonction : deux calculs de
// douze mois côte à côte finiraient par diverger d'un jour, et le calendrier
// manquerait sa dernière période sans que personne comprenne pourquoi.
const fenetre = fenetreDepuis(new Date(`${aujourdhui}T00:00:00Z`), 12);
const vacances = zone ? await getVacances(zone, fenetre.debut, fenetre.fin) : [];

// Les deux autres zones n'ont de sens qu'entre A, B et C : la Corse et
// l'outre-mer n'ont pas de « zone voisine ».
const METROPOLE = ["Zone A", "Zone B", "Zone C"];
const veutAutres = (await cookies()).get("zones_autres")?.value === "1";
const autresZones = veutAutres && zone && METROPOLE.includes(zone)
  ? await Promise.all(
      METROPOLE.filter((z) => z !== zone)
        .map(async (z) => ({ zone: z, periodes: await getVacances(z, fenetre.debut, fenetre.fin) })),
    )
  : [];
```

Passer `vacances`, `zone`, et `autresZones` aux deux composants ; afficher `<AutresZonesInterrupteur actif={veutAutres} />` sous l'en-tête, **uniquement** si `zone` est dans `METROPOLE`.

- [ ] **Step 3 : Le rendu**

`PlanningFrise` reçoit `autresZones: { zone: string; periodes: Periode[] }[]` (défaut `[]`) et, pour chacune, rend une piste fine sous la sienne : même calcul `barrePour`, hauteur réduite, opacité basse, la lettre de la zone en étiquette. `PlanningCalendrier` fait de même sur sa vue mensuelle — une pastille pâle plutôt qu'une bande pleine.

Le message `calendrierAbsent` existant sert désormais deux cas : pas de zone, et pas de calendrier. Ajouter, quand `zone` est nulle, un lien vers `/reglages` avec la clé `voyages.planning.choisirZone`.

- [ ] **Step 4 : Supprimer l'ancien**

```bash
git rm src/features/voyages/data/vacancesScolaires.ts src/features/voyages/data/vacancesScolaires.test.ts
grep -rn "VACANCES_ZONE_C\|ZONE_SCOLAIRE" src/ e2e/
```

Attendu : plus aucune occurrence. `npm run knip` doit rester à 0.

- [ ] **Step 5 : L'e2e**

```ts
test("la zone choisie s'affiche, et l'interrupteur révèle les autres", async ({ page }) => {
  await login(page);
  await page.goto("/fr/reglages");
  await page.getByTestId("zone-scolaire-select").selectOption("Zone C");
  await page.getByTestId("zone-scolaire-enregistrer").click();

  await page.goto("/fr/voyages/planning");
  await expect(page.getByTestId("planning-frise")).toContainText("Zone C");
  // Par défaut, une seule zone : c'est la décision PO.
  await expect(page.getByTestId("piste-zone-autre")).toHaveCount(0);

  await page.getByTestId("autres-zones").check();
  await expect(page.getByTestId("piste-zone-autre")).toHaveCount(2);

  // La mémoire de l'interrupteur est tout l'intérêt du cookie.
  await page.reload();
  await expect(page.getByTestId("piste-zone-autre")).toHaveCount(2);
});
```

**Attention :** ce test fait un vrai appel à l'API du ministère la première fois (le cache est vide après `db reset`). S'il devient instable en CI, la parade est de préremplir `vacances_scolaires` dans le seed plutôt que de neutraliser l'assertion.

- [ ] **Step 6 : Vérifier**

```bash
npx vitest run && npm run typecheck && npm run lint && npm run knip
supabase db reset && npm run test:rls
npm run test:e2e
```

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat(voyages): le planning suit la zone du foyer, les autres sur demande"
```

---

## Après le plan

Le seed de développement ne contient aucune ligne de `vacances_scolaires` : le premier rendu du planning ira donc chercher l'année sur l'API. C'est voulu — c'est aussi la seule façon de vérifier que la chaîne complète fonctionne. Si la CI devient instable à cause de cet appel, préremplir le seed est la réponse, pas l'assertion supprimée.
