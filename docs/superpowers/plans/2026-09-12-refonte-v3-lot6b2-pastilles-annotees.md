# Refonte v3 — lot 6B-2 : le garde-fou devient site-granulaire, et la dette devient exacte

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** faire dire la vérité au garde-fou anti-pastille — annoter site par site
ce qui est légitimement en forme de pastille, migrer les quatre sites qui sont
réellement des chips, et ne laisser en dette que ce que 6B-3 migrera vraiment.

**Architecture :** le garde-fou raisonne aujourd'hui par **fichier**, alors que
la réalité est par **site**. Il passe à une annotation en ligne. Les listes
`AUTORISES` et `DETTE` disparaissent au profit de deux marqueurs posés juste
au-dessus du code qu'ils justifient.

**Tech Stack :** Next.js 16, React 19, Tailwind v4 (jetons en variables CSS),
Vitest, Playwright.

**Spec :** `docs/superpowers/specs/2026-09-11-refonte-v3-lot6-composants-design.md`

## Global Constraints

- **Aucune teinte ni aucun rayon littéral**, **aucun `text-white`** : trois garde-fous existants les refusent.
- **Aucune nouvelle dépendance.** `fireEvent` de `@testing-library/react` ; jamais `@testing-library/user-event`, jamais `element.click()` natif.
- Toute prop publique d'un composant a un test qui échoue si elle cesse de fonctionner.
- Tout garde-fou est **éprouvé par cassure délibérée**, et l'échec doit tomber sur **l'assertion visée** — isoler avec `npx vitest run <fichier> -t "<nom>"`.
- Commentaires, noms de test et messages de commit en **français**.
- **`git add <chemins>` uniquement.** Jamais `-A`, jamais `.`.
- **Avant toute mesure, `git status --porcelain`** : s'il n'est pas vide, la mesure n'est pas celle de la branche.

## Ce que la lecture site par site a établi

Le spec partait de « 107 pastilles à migrer ». En lisant les 38 sites du lot
6B-2, l'écrasante majorité ne sont **pas des chips** :

| Nature réelle | Sites | Sort |
|---|---|---|
| Filtre/choix cliquable (`aria-pressed` + ternaire + `onClick`) | 4 | **migrés ici** |
| Bouton d'ACTION en forme de pastille (ajouter, supprimer, ouvrir) | 11 | annotés — ne migrent jamais |
| `<span>`/`<li>` descriptif (badge, compteur) | 10 | dette 6B-3 — vrais candidats à `TagChip` statique / `CountBadge` |
| `<label>` enveloppant un radio masqué | 3 | annotés — contrôles de formulaire |
| `<Link>` de navigation (`aria-current`) | 2 | annotés — ce sont des URL |
| Déclencheur de menu ou de modale (`aria-expanded`) | 2 | annotés |

Trois blocages d'API, tranchés **contre** l'élargissement des composants :

- `SousOnglets` emploie des `<Link>` : migrer transformerait de la navigation en
  état client, et ferait perdre le clic milieu, l'ouverture en onglet et le
  retour arrière. `SubTabPills` reste bouton + `onChange`.
- `OrigineForm` met un `<Avatar>` dans son chip et compense par `pl-1` ;
  `TagChip` n'expose pas de `className`, **volontairement**.
- `SejourContexteChips` ouvre une modale : c'est un déclencheur, pas un chip.

## Structure des fichiers

- `src/test/pastilles-faites-main.test.ts` — **réécrire**. Le cœur du lot.
- `src/features/places/ui/ExperienceForm.tsx`, `src/features/restos/ui/TagsAdmin.tsx`, `src/features/reco/ui/RechercheForm.tsx` — migrer.
- ~25 fichiers — recevoir une annotation par site légitime.

---

### Task 1 : le garde-fou passe au grain du site

**Files:**
- Modify: `src/test/pastilles-faites-main.test.ts`

**Interfaces:**
- Produces : deux marqueurs, posés sur la ligne précédant une pastille.
  - `// pastille-ok: <raison>` — légitime pour toujours.
  - `// pastille-dette: <lot> — <quoi>` — chip à migrer, dette explicite.

- [ ] **Step 1 : réécrire le test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources } from "./fichiersSources";

// Une pastille dessinée à la main est la dette que le lot 6 supprime. Ce test
// raisonne au SITE et non au fichier : la version par fichier ne pouvait rien
// dire d'un fichier mêlant une pastille migrable et une pastille légitime — il
// serait resté en dette pour toujours, ou aurait perdu toute surveillance.
const PASTILLE = /rounded-(pill|full)[^>]{0,200}?\bpx-|\bpx-[^>]{0,200}?rounded-(pill|full)/;

// Une pastille est excusée par un marqueur posé sur l'une des trois lignes qui
// la précèdent — la balise ouvrante et ses attributs s'étalent souvent sur
// plusieurs lignes, et exiger la ligne immédiatement au-dessus rendrait le
// marqueur impossible à placer sur la moitié des sites.
const OK = /\/\/\s*pastille-ok:\s*\S/;
const DETTE = /\/\/\s*pastille-dette:\s*\S/;

// Baissé par chaque lot qui migre ; jamais relevé sans que le message de commit
// dise pourquoi. Déclaré AVANT son usage : le laisser en fin de fichier
// marcherait (le callback s'exécute après l'évaluation du module) mais c'est
// exactement le genre de subtilité qui coûte une relecture.
const PLAFOND_DETTE = 0; // ajusté au step 3 de la tâche 3, depuis la sortie réelle

/** Chaque site de pastille du dépôt, avec son état d'annotation. */
function sites(): { fichier: string; ligne: number; etat: "ok" | "dette" | "nu" }[] {
  const out: { fichier: string; ligne: number; etat: "ok" | "dette" | "nu" }[] = [];
  for (const f of fichiersSources()) {
    if (!f.startsWith("features/") && !f.startsWith("app/")) continue;
    const L = readFileSync(path.join(SRC, f), "utf8").split("\n");
    L.forEach((l, i) => {
      if (!PASTILLE.test(l)) return;
      const avant = L.slice(Math.max(0, i - 3), i).join("\n");
      out.push({
        fichier: f,
        ligne: i + 1,
        etat: OK.test(avant) ? "ok" : DETTE.test(avant) ? "dette" : "nu",
      });
    });
  }
  return out;
}

describe("les pastilles", () => {
  // Une pastille sans marqueur est soit un chip qu'on aurait dû migrer, soit un
  // élément légitime dont personne n'a écrit la raison. Les deux méritent qu'on
  // s'arrête.
  it("portent toutes une raison ou une dette déclarée", () => {
    const nus = sites()
      .filter((s) => s.etat === "nu")
      .map((s) => `${s.fichier}:${s.ligne}`)
      .sort();
    expect(nus).toEqual([]);
  });

  // La dette doit DESCENDRE. Ce compte est le seul endroit où l'on voit qu'un
  // lot a réellement payé quelque chose plutôt que d'avoir déplacé des
  // étiquettes.
  it("ne laissent pas la dette remonter", () => {
    const restantes = sites().filter((s) => s.etat === "dette").length;
    expect(restantes).toBeLessThanOrEqual(PLAFOND_DETTE);
  });
});
```

- [ ] **Step 2 : lancer, et relever le nombre réel de sites nus**

Run : `npx vitest run src/test/pastilles-faites-main.test.ts`
Expected : **FAIL**, avec la liste complète des sites non annotés, sous la forme
`fichier:ligne`. Recopier cette liste — c'est le plan de travail des tâches 2
et 3. Fixer `PLAFOND_DETTE` à 0 pour l'instant ; il sera ajusté au step 3 de la
tâche 3, une fois les dettes réellement posées.

- [ ] **Step 3 : commit**

Le test est rouge et le reste jusqu'à la fin de la tâche 3. Ne PAS committer
maintenant : la branche ne doit jamais porter un commit dont la suite échoue.
Passer à la tâche 2.

---

### Task 2 : les quatre sites qui sont réellement des chips

**Files:**
- Modify: `src/features/places/ui/ExperienceForm.tsx:181,188`
- Modify: `src/features/restos/ui/TagsAdmin.tsx:34`
- Modify: `src/features/reco/ui/RechercheForm.tsx:37`

**Interfaces:**
- Consumes : `TagChip` (`ton`, `testId`, `onClick`), livré au lot 6B-1.

- [ ] **Step 1 : `ExperienceForm` — un filtre cumulatif et une affordance d'ajout**

Ligne 181, le tag sélectionnable (`bg-ink font-semibold text-app` actif) :

```tsx
              <TagChip key={tg.id} onClick={() => toggleTag(tg.id)}
                ton={selection.has(tg.id) ? "selectionne" : "defaut"}>
                {tg.label}
              </TagChip>
```

Ligne 188, l'ajout à la volée (bordure tiretée) :

```tsx
            <TagChip testId="tag-volee" onClick={() => setNouveau("")} ton="ajout">
              {t("tags.ajouterVolee")}
            </TagChip>
```

- [ ] **Step 2 : `TagsAdmin` — un filtre exclusif**

```tsx
          <TagChip key={s} onClick={() => setScope(s)}
            ton={scope === s ? "selectionne" : "defaut"}>
            {t(`tags.scopes.${s}`)}
          </TagChip>
```

- [ ] **Step 3 : `RechercheForm` — un filtre exclusif, au ton doux**

L'actif y est `border-accent bg-accent-50 text-ink`, soit le ton `actif-doux` au
texte près (`text-accent` au lieu de `text-ink`).

```tsx
            <TagChip key={it.key || "tous"} onClick={() => set("type", it.key)}
              ton={active ? "actif-doux" : "defaut"}>
              {it.label}
            </TagChip>
```

**Écart visuel assumé, à signaler dans le rapport** : le libellé actif passe de
`--ink` à `--accent`. C'est le ton du kit ; conserver `text-ink` demanderait une
variante de plus pour un seul site.

- [ ] **Step 4 : ajouter les imports et vérifier les tests d'écran**

`import { TagChip } from "@/features/shared/ui/TagChip";` dans les trois
fichiers.

Run : `npx vitest run src/features/places src/features/restos src/features/reco`
Expected : PASS. Un test qui cherchait une classe (`bg-ink`, `rounded-full`)
échouerait : le corriger vers le rôle ou le `data-testid`, jamais vers la classe.

- [ ] **Step 5 : les e2e des écrans touchés**

```bash
npx playwright test e2e/restos-tags.spec.ts e2e/recherche.spec.ts e2e/restos.spec.ts
```

Expected : vert. Ne PAS lancer `supabase db reset` : d'autres sessions partagent
cette base et un reset détruirait une migration en cours d'écriture chez elles.
Si la base paraît vide, employer `npx supabase migration up --local`.

---

### Task 3 : annoter tout ce qui reste

**Files:**
- Modify: ~25 fichiers, un marqueur par site.

- [ ] **Step 1 : poser `pastille-ok` sur ce qui est légitime**

Pour chaque site nu relevé à la tâche 1, lire le code et poser **la raison
réelle**, pas une formule. Les six familles rencontrées :

```tsx
// pastille-ok: bouton d'action, rond par commodité et non chip
// pastille-ok: lien de navigation (aria-current), pas un onglet piloté par l'état
// pastille-ok: contrôle de formulaire — <label> enveloppant un radio masqué
// pastille-ok: déclencheur de menu (aria-expanded), pas un chip
// pastille-ok: bouton flottant superposé à la carte
// pastille-ok: pastille sur la couleur d'un membre, hors du système de tons
```

**Ne pas annoter au jugé.** Une annotation fausse est pire que pas
d'annotation : elle éteint le garde-fou en prétendant l'avoir consulté. Si la
nature d'un site n'est pas claire en le lisant, le mettre en dette et le dire
dans le rapport.

- [ ] **Step 2 : poser `pastille-dette` sur les chips descriptifs**

Les `<span>`/`<li>` qui décrivent (badge de statut, compteur) sont de vrais
candidats à `TagChip` statique ou `CountBadge`, et attendent 6B-3 :

```tsx
// pastille-dette: 6B-3 — chip descriptif, candidat à TagChip statique
// pastille-dette: 6B-3 — compteur, candidat à CountBadge
```

- [ ] **Step 3 : fixer le plafond et vérifier**

Run : `npx vitest run src/test/pastilles-faites-main.test.ts`

Le premier test doit être **vert** (plus aucun site nu). Relever le nombre de
sites en dette et le porter dans `PLAFOND_DETTE`, avec un commentaire donnant la
date et le lot.

- [ ] **Step 4 : prouver que les deux tests mordent**

1. Ajouter `<span className="rounded-pill px-3 py-1">x</span>` sans marqueur dans
   `src/features/shared/ui/Card.tsx` → le premier test doit échouer en citant
   `features/shared/ui/Card.tsx:<ligne>`. Retirer.
2. Ajouter une pastille marquée `// pastille-dette: 6B-3 — essai` → le second
   test doit échouer sur le plafond. Retirer.

Isoler chaque course avec `-t` pour qu'aucun doute ne subsiste sur l'assertion
qui tombe. Recopier les quatre sorties.

- [ ] **Step 5 : vérification complète et commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
git add src/test/pastilles-faites-main.test.ts src/features src/app
git commit -m "feat(design): le garde-fou des pastilles raisonne au site, et la dette dit vrai"
```

---

### Task 4 : la suite complète et le coup d'œil

- [ ] **Step 1 : la suite**

```bash
npm run lint && npx tsc --noEmit && npm test && npx knip
npm run test:e2e
```

Sur l'e2e : si la base est douteuse, `npx supabase migration up --local` plutôt
qu'un `db reset` — d'autres sessions écrivent des migrations dans cette même
instance.

- [ ] **Step 2 : le coup d'œil du PO**

`npm run dev`, **dans les deux thèmes** :

- la fiche d'un restaurant, bloc « verdict » — les tags sélectionnables et
  l'ajout à la volée ;
- la page de gestion des tags — les filtres de portée ;
- la recherche — les filtres de type, dont le libellé actif passe de `--ink` à
  `--accent`.

---

## Ce que ce plan ne fait pas

- Il **n'élargit aucun composant**. `SubTabPills` ne gagne pas de mode lien,
  `TagChip` pas d'échappatoire de style. Le spec dit qu'ils refusent de tout
  faire ; les élargir pour vider une liste inverserait le rapport.
- Il ne migre **aucun** chip descriptif — c'est 6B-3, et c'est là que se trouvent
  les vrais candidats restants.
- Il ne touche pas à `CategoryTabs`, déjà migré en 6B-1 et dont les trois
  pastilles restantes seront annotées ici comme les autres.
