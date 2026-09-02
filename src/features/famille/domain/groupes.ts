// Groupes d'affichage de la liste Cercle (design Onglet_Cercle) : « moi » épinglé
// en tête, puis Mon foyer / Parents / Amis & autres, dérivés de la relation.
export type GroupeKey = "foyer" | "parents" | "autres";

const FOYER = new Set(["conjoint", "fille", "fils", "enfant"]);
const PARENTS = new Set(["pere", "mere", "parent", "beau_parent"]);

export function groupeFor(relation: string): GroupeKey {
  if (FOYER.has(relation)) return "foyer";
  if (PARENTS.has(relation)) return "parents";
  return "autres";
}

export function groupProches<T extends { relation: string }>(
  proches: T[],
): { moi: T | null; groupes: { key: GroupeKey; items: T[] }[] } {
  const moi = proches.find((p) => p.relation === "moi") ?? null;
  const rest = proches.filter((p) => p !== moi);
  const groupes = (["foyer", "parents", "autres"] as const)
    .map((key) => ({ key, items: rest.filter((p) => groupeFor(p.relation) === key) }))
    .filter((g) => g.items.length > 0);
  return { moi, groupes };
}

// Filtre de recherche insensible à la casse et aux accents (« pere » trouve « Père »)
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesQuery(haystacks: (string | null | undefined)[], q: string): boolean {
  const nq = norm(q.trim());
  if (!nq) return true;
  return haystacks.some((h) => h && norm(h).includes(nq));
}
