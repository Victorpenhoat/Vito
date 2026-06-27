# Slice 2 — Famille domaine + composants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les utils purs (expiration, masquage, couleur d'avatar) et les composants d'affichage (Avatar étendu, RelationChip, ExpiryBadge, DocTypeIcon) de l'épic Famille.

**Architecture:** Utils purs testés (TDD) dans `features/famille/domain/` + composants présentational dans `features/shared/ui/` (Avatar) et `features/famille/ui/` ; token `--danger-bg` ; i18n `famille.*`. Aucune donnée/écran.

**Tech Stack:** Next.js 16, Tailwind v4, next-intl (fr/en/it/es), lucide-react, Vitest.

## Global Constraints

- Aucune donnée/écran → e2e inchangé. Composants présentational (i18n via `useTranslations("famille")`).
- `Avatar` **étendu rétrocompatible** (sm/md inchangés ; `lg`/`xl` + `color` ajoutés ; défaut `bg-accent`).
- « Expire bientôt » réutilise `kpi-amber` ; « valide » `kpi-green` ; « expiré » `text-danger` + nouveau `bg-danger-bg`.
- Parité i18n 4 locales. Pas de chaîne en dur. TS strict.
- Réf. spec : `docs/superpowers/specs/2026-06-27-famille-slice-2-domaine-composants-design.md`.

---

### Task 1: Token `--danger-bg` + utils (TDD) + i18n

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/features/famille/domain/expiry.ts` + `expiry.test.ts`
- Create: `src/features/famille/domain/mask.ts` + `mask.test.ts`
- Create: `src/features/famille/domain/avatarColor.ts` + `avatarColor.test.ts`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/it.json`, `messages/es.json`

**Interfaces:**
- Produces : `expiryStatus(expiry: string | null, now: Date): "expired"|"soon"|"valid"|null` ; `monthsUntil(expiry: string, now: Date): number` ; `maskDocNumber(num: string | null): string` ; `avatarColor(seed: string): string` ; `--color-danger-bg` ; clés `famille.relations/docTypes/expiry`.

- [ ] **Step 1: Token `--danger-bg`**

In `src/app/globals.css`: dark block (`:root,[data-theme="dark"]`) add `--danger-bg: rgba(244,63,63,0.14);` next to `--danger`; light block add `--danger-bg: #FEF3F2;`; `@theme` add `--color-danger-bg: var(--danger-bg);`.

- [ ] **Step 2: Tests `expiry`**

Create `src/features/famille/domain/expiry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { expiryStatus, monthsUntil } from "./expiry";

const NOW = new Date("2026-06-27T00:00:00Z");

describe("expiryStatus", () => {
  it("null si pas de date", () => expect(expiryStatus(null, NOW)).toBeNull());
  it("expired si passé", () => expect(expiryStatus("2025-01-01", NOW)).toBe("expired"));
  it("soon si < 6 mois", () => expect(expiryStatus("2026-09-01", NOW)).toBe("soon"));
  it("valid si > 6 mois", () => expect(expiryStatus("2027-06-27", NOW)).toBe("valid"));
});
describe("monthsUntil", () => {
  it("compte les mois entiers restants", () => expect(monthsUntil("2026-09-27", NOW)).toBe(3));
  it("0 si déjà passé", () => expect(monthsUntil("2025-01-01", NOW)).toBe(0));
});
```

- [ ] **Step 3: Implémenter `expiry.ts`**

```ts
export function expiryStatus(expiry: string | null, now: Date): "expired" | "soon" | "valid" | null {
  if (!expiry) return null;
  const d = new Date(expiry);
  if (d.getTime() < now.getTime()) return "expired";
  const sixMonths = new Date(now);
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return d.getTime() < sixMonths.getTime() ? "soon" : "valid";
}

export function monthsUntil(expiry: string, now: Date): number {
  const d = new Date(expiry);
  if (d.getTime() <= now.getTime()) return 0;
  let months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) months -= 1;
  return Math.max(0, months);
}
```

- [ ] **Step 4: Tests + impl `mask.ts`**

Test `src/features/famille/domain/mask.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { maskDocNumber } from "./mask";
describe("maskDocNumber", () => {
  it("nul → vide", () => expect(maskDocNumber(null)).toBe(""));
  it("révèle les 3 derniers", () => expect(maskDocNumber("12AB45892")).toBe("••••••892"));
  it("≤3 → tout masqué", () => expect(maskDocNumber("12")).toBe("••"));
});
```
Impl `src/features/famille/domain/mask.ts`:
```ts
export function maskDocNumber(num: string | null): string {
  if (!num) return "";
  if (num.length <= 3) return "•".repeat(num.length);
  return "•".repeat(num.length - 3) + num.slice(-3);
}
```

- [ ] **Step 5: Tests + impl `avatarColor.ts`**

Test `src/features/famille/domain/avatarColor.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { avatarColor, AVATAR_PALETTE } from "./avatarColor";
describe("avatarColor", () => {
  it("déterministe pour un même seed", () => expect(avatarColor("abc")).toBe(avatarColor("abc")));
  it("renvoie une couleur de la palette", () => expect(AVATAR_PALETTE).toContain(avatarColor("xyz")));
});
```
Impl `src/features/famille/domain/avatarColor.ts`:
```ts
export const AVATAR_PALETTE = ["#211E1A", "#6B7A8F", "#8A7A64", "#9A8466", "#5E7163"] as const;

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]!;
}
```

- [ ] **Step 6: i18n `famille.*` (4 locales)**

Ajouter le namespace racine `famille` (ou compléter s'il existe) avec :
- `relations` : `conjoint`/`enfant`/`parent`/`beau_parent`/`ami`/`autre` — fr « Conjoint·e/Enfant/Parent/Beau-parent/Ami·e/Autre » ; en « Partner/Child/Parent/In-law/Friend/Other » ; it « Coniuge/Figlio/Genitore/Suocero/Amico/Altro » ; es « Pareja/Hijo/Padre/Suegro/Amigo/Otro ».
- `docTypes` : `passeport`/`carte_identite`/`permis_conduire`/`permis_bateau`/`visa`/`titre_sejour`/`autre` — fr « Passeport/Carte d'identité/Permis de conduire/Permis bateau/Visa/Titre de séjour/Autre » + EN/IT/ES.
- `expiry` : `valide`/`expireDans`/`expire` — fr « Valide » / « Expire dans {n} mois » / « Expiré » + EN/IT/ES (`expireDans` ICU `{n}`).

(Si un namespace `famille` existe déjà avec d'autres clés, **les conserver** et ajouter ces sous-objets.)

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (utils verts ; parité i18n verte).

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/features/famille/domain/expiry.ts src/features/famille/domain/expiry.test.ts src/features/famille/domain/mask.ts src/features/famille/domain/mask.test.ts src/features/famille/domain/avatarColor.ts src/features/famille/domain/avatarColor.test.ts messages/fr.json messages/en.json messages/it.json messages/es.json
git commit -m "feat(famille): token danger-bg + utils expiry/mask/avatarColor (TDD) + i18n"
```

---

### Task 2: Composants (Avatar étendu + RelationChip + ExpiryBadge + DocTypeIcon)

**Files:**
- Modify: `src/features/shared/ui/Avatar.tsx`
- Create: `src/features/famille/ui/RelationChip.tsx`
- Create: `src/features/famille/ui/ExpiryBadge.tsx`
- Create: `src/features/famille/ui/DocTypeIcon.tsx`

**Interfaces:**
- Consumes : `avatarColor` (optionnel, par les écrans) ; clés `famille.*`.
- Produces : `Avatar({ name, size?, color? })` ; `RelationChip({ relation })` ; `ExpiryBadge({ status, monthsLeft? })` ; `DocTypeIcon({ docType })`.

- [ ] **Step 1: Étendre `Avatar.tsx`**

Replace `src/features/shared/ui/Avatar.tsx` with:
```tsx
import { initials } from "./helpers";

const DIM: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-[46px] w-[46px] text-base",
  xl: "h-[72px] w-[72px] text-2xl",
};

export function Avatar({ name, size = "md", color }: { name: string; size?: "sm" | "md" | "lg" | "xl"; color?: string }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-full font-semibold text-white ${DIM[size]} ${color ? "" : "bg-accent"}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
```

- [ ] **Step 2: `RelationChip.tsx`**

```tsx
import { useTranslations } from "next-intl";

export function RelationChip({ relation }: { relation: string }) {
  const t = useTranslations("famille");
  return (
    <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent">
      {t(`relations.${relation}`)}
    </span>
  );
}
```

- [ ] **Step 3: `ExpiryBadge.tsx`**

```tsx
import { useTranslations } from "next-intl";

export function ExpiryBadge({ status, monthsLeft }: { status: "expired" | "soon" | "valid"; monthsLeft?: number }) {
  const t = useTranslations("famille");
  const cls =
    status === "valid" ? "bg-kpi-green-bg text-kpi-green"
    : status === "soon" ? "bg-kpi-amber-bg text-kpi-amber"
    : "bg-danger-bg text-danger";
  const label =
    status === "valid" ? t("expiry.valide")
    : status === "soon" ? t("expiry.expireDans", { n: monthsLeft ?? 0 })
    : t("expiry.expire");
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
```

- [ ] **Step 4: `DocTypeIcon.tsx`**

```tsx
import { BookUser, IdCard, Car, Ship, Stamp, FileBadge, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  passeport: BookUser,
  carte_identite: IdCard,
  permis_conduire: Car,
  permis_bateau: Ship,
  visa: Stamp,
  titre_sejour: FileBadge,
  autre: FileText,
};

export function DocTypeIcon({ docType }: { docType: string }) {
  const Icon = ICONS[docType] ?? FileText;
  return (
    <span className="grid h-10 w-10 place-items-center rounded-[6px] bg-accent-50 text-accent">
      <Icon size={20} />
    </span>
  );
}
```
(Si `IdCard`/`FileBadge`/`Stamp` n'existent pas dans la version lucide installée, remplacer par un nom équivalent existant ou `FileText` — vérifier via le typecheck.)

- [ ] **Step 5: Vérifier typecheck + lint + unit**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/shared/ui/Avatar.tsx src/features/famille/ui/RelationChip.tsx src/features/famille/ui/ExpiryBadge.tsx src/features/famille/ui/DocTypeIcon.tsx
git commit -m "feat(famille): Avatar étendu (couleur/tailles) + RelationChip/ExpiryBadge/DocTypeIcon"
```

---

### Task 3: Non-régression + build

- [ ] **Step 1: e2e complète + build**

Run: `supabase db reset && npx playwright test --retries=0 && npm run build`
Expected: suite e2e **verte** (Avatar rétrocompatible : shell/ui-kit inchangés) + build OK. (Flake connu `liste_items`/anon → relancer une fois.)

- [ ] **Step 2: Commit (si correctifs)**

```bash
git add -A && git commit -m "fix(famille): correctifs non-régression composants" # seulement si nécessaire
```

---

## Notes d'exécution

- **Ordre** : T1 (token+utils+i18n) → T2 (composants) → T3 (non-régression).
- **Prod** : aucune migration. Au « go prod » : merge → Vercel redéploie.
- **Filet** : `Avatar` sm/md inchangés (usages shell/ui-kit) ; composants présentational sans dépendance données. Si l'e2e casse, réparer le composant, jamais le test.
