# Slice 7 — Cercle « Le Carnet » (Famille + Conciergerie + Abonnement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinner les trois écrans du groupe Cercle (Famille, Conciergerie, Abonnement) au style Le Carnet — sans casser l'e2e, sans migration. Dernière slice de l'épic.

**Architecture:** Re-skin présentationnel : en-têtes eyebrow + titres serif, 2 colonnes, pastilles de statut, grille tarifaire. Aucune requête/action modifiée. `DemandesList` gagne une pastille de statut colorée ; l'Abonnement devient une grille tarifaire Gratuit/Premium (prix validés PO).

**Tech Stack:** Next.js 16 (Server Components), Tailwind v4, next-intl (fr/en/it/es), Vitest, Playwright.

## Global Constraints

- **Pas de migration, pas de nouveau data.** Re-skin présentationnel.
- **e2e verts SANS modification** — préserver :
  - Famille : `famille-form`, `ajouter-famille`, `invite-form`, `membre-row`, `famille-resto-row`, `resto-search`.
  - Conciergerie : `demande-resto-form` (dans FicheResto, hors scope), `demande-row`, `demande-statut` (**texte = `t("statuts.<s>")` inchangé**), `reponse-form`.
  - Abonnement : `plan-actuel` (contient « jusqu'au » si annulé), `premium-badge`, `subscribe-monthly`, `subscribe-yearly`, `subscribe-form`, `cancel-sub`.
  - Sous-composants `SubscribeButtons`/`CancelButton`/`DemandeHotelForm`/`InviteForm`/`MembresList`/`FamilleRestos`/`ConciergeInbox`/`ReponseForm` montés inchangés.
- `conciergerie-premium-cta` vit dans `FicheResto` (déjà fait, NON touché ici).
- Statuts conciergerie : `nouvelle | en_cours | confirmee | refusee`.
- Fondations Slices 0-6 (`font-serif`, `text-faint`, `text-muted`, `border-line`, `border-line-soft`, `rounded-card`, `accent-50`, tokens `kpi-*`, kit `PageHeader`/`SectionLabel`/`Card`).
- Parité i18n (4 locales) garantie par `messages-parity.test.ts`. Pas de chaîne en dur. Prix PO : 9,90 €/mois · 99 €/an.
- TS strict.
- Réf. spec : `docs/superpowers/specs/2026-06-26-carnet-slice-7-cercle-design.md`.

---

### Task 1: i18n Cercle (4 locales)

**Files:**
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : `famille.eyebrow` ; `conciergerie.eyebrow`/`conciergerie.premiumActif` ; `abonnement.eyebrow/gratuit/gratuitPrix/gratuitSous/prixMois/prixAn` + `abonnement.feat.{carnet,voyages,conciergerie,foyer}`.

- [ ] **Step 1: Ajouter les clés (4 locales)**

`messages/fr.json` — sous `famille` : `"eyebrow":"Mon foyer"` ; sous `conciergerie` : `"eyebrow":"Service premium"`, `"premiumActif":"Premium actif"` ; sous `abonnement` : `"eyebrow":"Votre formule"`, `"gratuit":"Gratuit"`, `"gratuitPrix":"0 €"`, `"gratuitSous":"pour toujours"`, `"prixMois":"9,90 € / mois"`, `"prixAn":"ou 99 € / an"`, `"feat":{"carnet":"Carnet de restos & vins","voyages":"Voyages & réservations","conciergerie":"Conciergerie illimitée","foyer":"Foyer partagé"}`.

`messages/en.json` — `famille.eyebrow`:"My household" ; `conciergerie.eyebrow`:"Premium service", `premiumActif`:"Premium active" ; `abonnement` : `eyebrow`:"Your plan", `gratuit`:"Free", `gratuitPrix`:"0 €", `gratuitSous`:"forever", `prixMois`:"€9.90 / month", `prixAn`:"or €99 / year", `feat`:{"carnet":"Restaurants & wine journal","voyages":"Trips & bookings","conciergerie":"Unlimited concierge","foyer":"Shared household"}.

`messages/it.json` — `famille.eyebrow`:"Il mio nucleo" ; `conciergerie.eyebrow`:"Servizio premium", `premiumActif`:"Premium attivo" ; `abonnement` : `eyebrow`:"Il tuo piano", `gratuit`:"Gratuito", `gratuitPrix`:"0 €", `gratuitSous`:"per sempre", `prixMois`:"9,90 € / mese", `prixAn`:"o 99 € / anno", `feat`:{"carnet":"Taccuino ristoranti e vini","voyages":"Viaggi e prenotazioni","conciergerie":"Concierge illimitato","foyer":"Nucleo condiviso"}.

`messages/es.json` — `famille.eyebrow`:"Mi hogar" ; `conciergerie.eyebrow`:"Servicio premium", `premiumActif`:"Premium activo" ; `abonnement` : `eyebrow`:"Tu fórmula", `gratuit`:"Gratis", `gratuitPrix`:"0 €", `gratuitSous`:"para siempre", `prixMois`:"9,90 € / mes", `prixAn`:"o 99 € / año", `feat`:{"carnet":"Cuaderno de restaurantes y vinos","voyages":"Viajes y reservas","conciergerie":"Conserjería ilimitada","foyer":"Hogar compartido"}.

- [ ] **Step 2: Vérifier la parité**

Run: `npm run test -- messages-parity`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(carnet,cercle,i18n): eyebrows + grille tarifaire abonnement (4 locales)"
```

---

### Task 2: Famille (page re-skin)

**Files:**
- Modify: `src/app/[locale]/(app)/famille/page.tsx`

**Interfaces:**
- Consumes : `getMaFamille`/`getFamilleRestos` (inchangés), `MembresList`/`InviteForm`/`FamilleRestos`/`FamilleForm` (inchangés), `PageHeader`/`SectionLabel`/`Card`.

- [ ] **Step 1: Recomposer `famille/page.tsx`**

Replace `src/app/[locale]/(app)/famille/page.tsx` with:
```tsx
import { getTranslations } from "next-intl/server";
import { getMaFamille, getFamilleRestos } from "@/features/famille/data/queries";
import { FamilleForm } from "@/features/famille/ui/FamilleForm";
import { InviteForm } from "@/features/famille/ui/InviteForm";
import { MembresList } from "@/features/famille/ui/MembresList";
import { FamilleRestos } from "@/features/famille/ui/FamilleRestos";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Card } from "@/features/shared/ui/Card";

export default async function FamillePage() {
  const t = await getTranslations("famille");
  const ma = await getMaFamille();
  if (!ma) {
    return (
      <main className="flex flex-col gap-6 p-4 md:p-8">
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
        <FamilleForm />
      </main>
    );
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const currentProfileId = auth.user?.id ?? "";
  const restos = await getFamilleRestos(ma.famille.id);
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={ma.famille.nom} subtitle={`${ma.membres.length} · ${restos.length}`} />
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3">
          <SectionLabel>{t("membres")}</SectionLabel>
          <MembresList membres={ma.membres} isOwner={ma.isOwner} currentProfileId={currentProfileId} />
          {ma.isOwner && <InviteForm />}
        </section>
        <aside>
          <Card>
            <SectionLabel>{t("restos")}</SectionLabel>
            <div className="font-serif text-4xl font-medium text-ink">{restos.length}</div>
          </Card>
        </aside>
      </div>
      <section className="flex flex-col gap-3">
        <SectionLabel>{t("restos")}</SectionLabel>
        <FamilleRestos restos={restos} />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Vérifier** — Run: `npm run typecheck && npm run lint && npm run test` → PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(app)/famille/page.tsx"
git commit -m "feat(carnet,cercle): Famille — en-tête éditorial + 2 colonnes"
```

---

### Task 3: Conciergerie (page re-skin + pastille statut)

**Files:**
- Modify: `src/app/[locale]/(app)/conciergerie/page.tsx`
- Modify: `src/features/conciergerie/ui/DemandesList.tsx`

**Interfaces:**
- Consumes : `getSessionRole`/`getMesDemandes`/`getInboxConciergerie` (inchangés), `getIsPremium`, `DemandesList`/`DemandeHotelForm`/`ConciergeInbox` (inbox inchangée), `PageHeader`/`SectionLabel`/`Card`.

- [ ] **Step 1: Pastille de statut colorée dans `DemandesList.tsx`**

In `src/features/conciergerie/ui/DemandesList.tsx`, replace the `Badge` import usage by a colored pill keeping `data-testid="demande-statut"` and the exact label. Add a status→class map and re-skin the row. New file:
```tsx
import { getTranslations } from "next-intl/server";
import { dureeFromNuits } from "../domain/duree";

type Etab = { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
type Demande = {
  id: string; type: string; statut: string; reponse: string | null;
  date_debut: string | null; nombre_nuits: number | null; commentaire: string | null;
  etablissement: Etab;
};

function etabNom(e: Etab): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nom ?? "";
}

const STATUT_CLASS: Record<string, string> = {
  nouvelle: "bg-kpi-blue-bg text-kpi-blue",
  en_cours: "bg-kpi-amber-bg text-kpi-amber",
  confirmee: "bg-kpi-green-bg text-kpi-green",
  refusee: "bg-badge text-muted",
};

export async function DemandesList({ demandes }: { demandes: Demande[] }) {
  const t = await getTranslations("conciergerie");
  if (demandes.length === 0) return <p className="text-sm text-muted">{t("vide")}</p>;
  return (
    <ul className="flex flex-col">
      {demandes.map((d) => (
        <li key={d.id} data-testid="demande-row" className="flex flex-col gap-1 border-b border-line-soft py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-serif text-lg text-ink">{t(`types.${d.type}`)}{etabNom(d.etablissement) ? ` · ${etabNom(d.etablissement)}` : ""}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${STATUT_CLASS[d.statut] ?? "bg-badge text-muted"}`}>
              <span data-testid="demande-statut">{t(`statuts.${d.statut}`)}</span>
            </span>
          </div>
          {d.type === "hotel" && d.date_debut && d.nombre_nuits !== null && (
            <span className="text-sm text-muted">{d.date_debut} → {dureeFromNuits(d.date_debut, d.nombre_nuits)}</span>
          )}
          {d.commentaire && <p className="text-sm text-muted">{d.commentaire}</p>}
          {d.reponse && <p className="text-sm text-muted">{t("reponse")} : {d.reponse}</p>}
        </li>
      ))}
    </ul>
  );
}
```
(`data-testid="demande-statut"` conservé, texte = `t("statuts.<s>")` inchangé → e2e `toHaveText("Nouvelle")` tient.)

- [ ] **Step 2: Recomposer `conciergerie/page.tsx`**

Replace `src/app/[locale]/(app)/conciergerie/page.tsx` with:
```tsx
import { getTranslations } from "next-intl/server";
import { getSessionRole } from "@/lib/rbac/guards";
import { getMesDemandes, getInboxConciergerie } from "@/features/conciergerie/data/queries";
import { getIsPremium } from "@/features/abonnement/data/queries";
import { DemandesList } from "@/features/conciergerie/ui/DemandesList";
import { DemandeHotelForm } from "@/features/conciergerie/ui/DemandeHotelForm";
import { ConciergeInbox } from "@/features/conciergerie/ui/ConciergeInbox";
import { PageHeader } from "@/features/shared/ui/PageHeader";
import { SectionLabel } from "@/features/shared/ui/SectionLabel";
import { Card } from "@/features/shared/ui/Card";

export default async function ConciergeriePage() {
  const t = await getTranslations("conciergerie");
  const role = await getSessionRole();
  const isStaff = role === "agence" || role === "admin";
  if (isStaff) {
    const demandes = await getInboxConciergerie();
    return (
      <main className="flex flex-col gap-6 p-4 md:p-8">
        <PageHeader eyebrow={t("eyebrow")} title={t("inbox")} />
        <ConciergeInbox demandes={demandes} />
      </main>
    );
  }
  const [demandes, isPremium] = await Promise.all([getMesDemandes(), getIsPremium()]);
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        action={isPremium ? <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-surface">{t("premiumActif")}</span> : undefined}
      />
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3">
          <SectionLabel>{t("mesDemandes")}</SectionLabel>
          <DemandesList demandes={demandes} />
        </section>
        <aside>
          <Card>
            <SectionLabel>{t("types.hotel")}</SectionLabel>
            <DemandeHotelForm />
          </Card>
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 4: e2e conciergerie (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/conciergerie.spec.ts --retries=0`
Expected: PASS sans modifier le spec (`demande-row`, `demande-statut` texte « Nouvelle »/« Confirmée », `reponse-form` côté staff). Retry une fois si le webServer échoue.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(app)/conciergerie/page.tsx" src/features/conciergerie/ui/DemandesList.tsx
git commit -m "feat(carnet,cercle): Conciergerie — en-tête + demandes avec pastille de statut"
```

---

### Task 4: Abonnement (grille tarifaire)

**Files:**
- Modify: `src/app/[locale]/(app)/abonnement/page.tsx`

**Interfaces:**
- Consumes : `getSubscription`/`getIsPremium` (inchangés), `SubscribeButtons`/`CancelButton` (inchangés), `PageHeader`.

- [ ] **Step 1: Recomposer `abonnement/page.tsx` (grille Gratuit/Premium)**

Replace `src/app/[locale]/(app)/abonnement/page.tsx` with:
```tsx
import { getTranslations } from "next-intl/server";
import { getSubscription, getIsPremium } from "@/features/abonnement/data/queries";
import { SubscribeButtons } from "@/features/abonnement/ui/SubscribeButtons";
import { CancelButton } from "@/features/abonnement/ui/CancelButton";
import { PageHeader } from "@/features/shared/ui/PageHeader";

function FeatureRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <span className={ok ? "text-accent" : "text-faint"}>{ok ? "✓" : "—"}</span>
      <span className={ok ? "text-ink" : "text-faint"}>{label}</span>
    </li>
  );
}

export default async function AbonnementPage() {
  const t = await getTranslations("abonnement");
  const sub = await getSubscription();
  const isPremium = await getIsPremium();
  const canceled = sub?.status === "canceled";
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("fr-FR") : "";
  const feats = [
    { key: "carnet", free: true },
    { key: "voyages", free: true },
    { key: "conciergerie", free: false },
    { key: "foyer", free: false },
  ] as const;
  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <div className="grid max-w-3xl gap-5 md:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{t("gratuit")}</div>
          <div className="mt-2 font-serif text-3xl font-medium text-ink">{t("gratuitPrix")}</div>
          <div className="text-sm text-muted">{t("gratuitSous")}</div>
          <ul className="mt-4 border-t border-line-soft pt-2">
            {feats.map((f) => <FeatureRow key={f.key} ok={f.free} label={t(`feat.${f.key}`)} />)}
          </ul>
        </div>
        <div data-testid="plan-actuel" className="relative rounded-card border-[1.5px] border-accent bg-surface p-7">
          {isPremium && (
            <span data-testid="premium-badge" className="absolute right-5 top-5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">{t("premium")}</span>
          )}
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{t("premium")}</div>
          <div className="mt-2 font-serif text-3xl font-medium text-ink">{t("prixMois")}</div>
          <div className="text-sm text-muted">{t("prixAn")}</div>
          <ul className="mt-4 border-t border-line-soft pt-2">
            {feats.map((f) => <FeatureRow key={f.key} ok={true} label={t(`feat.${f.key}`)} />)}
          </ul>
          <div className="mt-5 flex flex-col gap-2">
            {!isPremium && <SubscribeButtons />}
            {isPremium && !canceled && <CancelButton />}
            {isPremium && (
              <p className="text-sm text-muted">{canceled ? t("premiumUntil", { date: periodEnd }) : t("renewsOn", { date: periodEnd })}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
```
(`plan-actuel` présent dans tous les états ; `premium-badge` si premium ; `subscribe-monthly`/`subscribe-yearly` via `SubscribeButtons` quand free ; `cancel-sub` via `CancelButton` quand premium actif ; `premiumUntil` contient « jusqu'au » quand annulé.)

- [ ] **Step 2: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 3: e2e abonnement (non-régression ciblée)**

Run: `supabase db reset && npx playwright test e2e/abonnement.spec.ts --retries=0`
Expected: PASS sans modifier le spec (free → `subscribe-monthly` → `premium-badge` ; `cancel-sub` → `plan-actuel` contient « jusqu'au » ; limites de voyages côté voyages inchangées). Retry une fois si le webServer échoue.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(app)/abonnement/page.tsx"
git commit -m "feat(carnet,cercle): Abonnement — grille tarifaire Gratuit/Premium"
```

---

### Task 5: Non-régression complète + build

- [ ] **Step 1: Suite e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite complète **verte sans modifier les specs** + build OK. Un seul `db reset` avant. Si un spec casse, corriger le composant (testid/flux), **pas** le test. Retry une fois si le webServer échoue.

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(carnet,cercle): correctifs non-régression Slice 7" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (i18n) → T2 (Famille) → T3 (Conciergerie) → T4 (Abonnement) → T5 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie `main`.
- **Filet** : `demande-statut` doit garder son texte exact (`t("statuts.<s>")`) ; `plan-actuel`/`premium-badge`/`subscribe-monthly`/`cancel-sub` présents selon l'état. Si un e2e casse, réparer le composant, jamais le test.
- Après T5 : **fin de l'épic Le Carnet** (tous les écrans de la maquette re-skinnés).
