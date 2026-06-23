export type Role = "client" | "agence" | "admin";
export type NavKey =
  | "accueil" | "restos" | "vins" | "recherche" | "voyages" | "famille"
  | "depenses" | "conciergerie" | "abonnement" | "agence" | "admin";

export type NavEntry = { key: NavKey; href: string; roles?: Role[] };

export const NAV_ITEMS: NavEntry[] = [
  { key: "accueil", href: "/accueil" },
  { key: "restos", href: "/restos" },
  { key: "vins", href: "/vins" },
  { key: "recherche", href: "/recherche" },
  { key: "voyages", href: "/voyages" },
  { key: "famille", href: "/famille" },
  { key: "depenses", href: "/depenses" },
  { key: "conciergerie", href: "/conciergerie" },
  { key: "abonnement", href: "/abonnement" },
  { key: "agence", href: "/agence", roles: ["agence", "admin"] },
  { key: "admin", href: "/admin", roles: ["admin"] },
];

export const BOTTOM_KEYS: NavKey[] = ["accueil", "restos", "voyages", "recherche"];

export function filterNav(items: NavEntry[], role: Role): NavEntry[] {
  return items.filter((i) => !i.roles || i.roles.includes(role));
}
