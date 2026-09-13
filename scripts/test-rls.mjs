// Lance la suite pgTAP sur une base dont l'état est CONNU.
//
//   npm run test:rls
//
// Plusieurs assertions historiques comptent les lignes du seed (« le client
// voit ses 5 liste_items »). Un run e2e passé avant les fait rougir sans
// qu'une ligne de code soit en cause — 85 assertions sur 120 le 2026-09-12,
// et deux sessions s'y sont trompées le même jour. Le remède est une base
// fraîche, pas une assertion affaiblie : un décompte exact attrape une fuite
// qui AJOUTE des lignes visibles au propriétaire légitime, ce qu'un « zéro
// ligne d'autrui » laisserait passer.
//
// Mais on ne remet à zéro que ce qui n'appartient qu'à nous : dans le checkout
// principal, la pile est partagée avec les autres sessions, et un reset de
// courtoisie y a déjà effacé quatre fois la migration d'un voisin. D'où la
// condition — la pile isolée d'un worktree (.supabase-local, cf.
// `npm run supabase:worktree`) se remet à zéro toute seule ; la pile partagée,
// jamais, on se contente de le dire.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const isolee = existsSync(path.join(process.cwd(), ".supabase-local"));
const supabase = (...args) =>
  spawnSync("node", [path.join("scripts", "supabase.mjs"), ...args], { stdio: "inherit" });

if (isolee) {
  console.log("Pile isolée : remise à zéro avant les tests (personne d'autre ne la lit).");
  // Pile arrêtée : `db reset` refuse, mais `start` applique migrations ET seed —
  // il rend donc exactement l'état voulu. Échouer ici obligerait à connaître
  // par cœur l'ordre des commandes pour lancer une suite de tests.
  if (supabase("db", "reset").status !== 0) {
    console.log("Pile arrêtée : démarrage (il applique les migrations et le seed).");
    const start = supabase("start");
    if (start.status !== 0) process.exit(start.status ?? 1);
  }
} else {
  console.log("Pile PARTAGÉE : pas de remise à zéro — elle effacerait le travail d'une autre");
  console.log("session. Si un run e2e est passé avant, des assertions de décompte peuvent");
  console.log("rougir sans cause réelle : `npm run supabase:worktree` donne une pile à soi.");
}

process.exit(supabase("test", "db").status ?? 1);
