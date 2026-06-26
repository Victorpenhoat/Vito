export type Role = "client" | "agence" | "admin";
export type NavGroup = "carnet" | "voyages" | "cercle";
export type NavKey =
  | "accueil" | "restos" | "hotels" | "vins" | "recherche" | "voyages" | "famille"
  | "depenses" | "conciergerie" | "abonnement" | "agence" | "admin";

export type NavEntry = { key: NavKey; href: string; group: NavGroup; roles?: Role[] };

export const NAV_ITEMS: NavEntry[] = [
  { key: "accueil", href: "/accueil", group: "carnet" },
  { key: "restos", href: "/restos", group: "carnet" },
  { key: "hotels", href: "/hotels", group: "carnet" },
  { key: "vins", href: "/vins", group: "carnet" },
  { key: "recherche", href: "/recherche", group: "carnet" },
  { key: "voyages", href: "/voyages", group: "voyages" },
  { key: "depenses", href: "/depenses", group: "voyages" },
  { key: "famille", href: "/famille", group: "cercle" },
  { key: "conciergerie", href: "/conciergerie", group: "cercle" },
  { key: "abonnement", href: "/abonnement", group: "cercle" },
  { key: "agence", href: "/agence", group: "cercle", roles: ["agence", "admin"] },
  { key: "admin", href: "/admin", group: "cercle", roles: ["admin"] },
];

export const BOTTOM_KEYS: NavKey[] = ["accueil", "restos", "voyages", "recherche"];

export const NAV_GROUPS: NavGroup[] = ["carnet", "voyages", "cercle"];

export function filterNav(items: NavEntry[], role: Role): NavEntry[] {
  return items.filter((i) => !i.roles || i.roles.includes(role));
}

export function groupNav(items: NavEntry[]): { group: NavGroup; entries: NavEntry[] }[] {
  return NAV_GROUPS
    .map((group) => ({ group, entries: items.filter((i) => i.group === group) }))
    .filter((g) => g.entries.length > 0);
}
