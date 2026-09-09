export type Role = "client" | "agence" | "admin";
export type NavGroup = "carnet" | "voyages" | "cercle";
export type NavKey =
  | "accueil" | "restos" | "hotels" | "vins" | "recherche" | "voyages" | "famille"
  | "reception" | "depenses" | "conciergerie" | "abonnement" | "agence" | "admin"
  | "activites";

export type NavEntry = { key: NavKey; href: string; group: NavGroup; roles?: Role[] };

export const NAV_ITEMS: NavEntry[] = [
  { key: "accueil", href: "/accueil", group: "carnet" },
  { key: "restos", href: "/restos", group: "carnet" },
  { key: "hotels", href: "/hotels", group: "carnet" },
  { key: "vins", href: "/vins", group: "carnet" },
  { key: "recherche", href: "/recherche", group: "carnet" },
  { key: "voyages", href: "/voyages", group: "voyages" },
  { key: "depenses", href: "/depenses", group: "voyages" },
  // Les activités du foyer : dans le Cercle, parce que c'est de ses membres
  // qu'elles parlent — et juste avant lui, comme le montre le design desktop.
  { key: "activites", href: "/activites", group: "cercle" },
  { key: "famille", href: "/famille", group: "cercle" },
  // Boîte de réception : ce qu'un proche m'a recommandé (lot 2). Dans le Cercle,
  // parce que c'est de là que ça vient.
  { key: "reception", href: "/reception", group: "cercle" },
  { key: "conciergerie", href: "/conciergerie", group: "cercle" },
  { key: "abonnement", href: "/abonnement", group: "cercle" },
  { key: "agence", href: "/agence", group: "cercle", roles: ["agence", "admin"] },
  { key: "admin", href: "/admin", group: "cercle", roles: ["admin"] },
];

// Décisions PO 2026-09 (designs Onglet Cercle puis Onglet Voyages) : la bottom nav
// suit le design — Accueil / Restos / Hôtels / Voyages / Cercle + « Plus » ;
// Recherche et le reste vivent dans le drawer et la sidebar.
// Design Activités : la barre du bas devient Restos · Hôtels · Voyages ·
// Activités · Cercle. Accueil en sort — cinq emplacements, et on ouvre l'app
// pour une adresse ou un horaire, pas pour un tableau de bord. Il reste à un
// doigt dans le tiroir « Plus » et dans la barre latérale.
export const BOTTOM_KEYS: NavKey[] = ["restos", "hotels", "voyages", "activites", "famille"];

const NAV_GROUPS: NavGroup[] = ["carnet", "voyages", "cercle"];

/**
 * Entrées visibles pour ce rôle — et, dans la coque iOS, sans l'abonnement.
 *
 * La règle 3.1.1 d'Apple réserve aux achats intégrés tout ce qui débloque des
 * fonctions dans l'app. Plutôt que d'implémenter StoreKit pour un carnet
 * personnel, on ne propose pas l'abonnement dans l'app : il se prend sur le
 * web, et l'app en tient compte. C'est ce que font Netflix ou Spotify.
 */
export function filterNav(items: NavEntry[], role: Role, dansLaCoque = false): NavEntry[] {
  return items.filter(
    (i) => (!i.roles || i.roles.includes(role)) && !(dansLaCoque && i.key === "abonnement"),
  );
}

export function groupNav(items: NavEntry[]): { group: NavGroup; entries: NavEntry[] }[] {
  return NAV_GROUPS
    .map((group) => ({ group, entries: items.filter((i) => i.group === group) }))
    .filter((g) => g.entries.length > 0);
}
