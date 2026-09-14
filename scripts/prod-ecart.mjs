// Dit si la production a bien reçu toutes les migrations de ce checkout.
//
//   npm run prod:ecart
//
// Sort 0 quand tout y est, 1 quand il manque quelque chose, 2 quand la
// question n'a pas pu être posée (pas de lien, pas d'identifiants, réseau).
// Ces trois issues sont distinctes exprès : en CI, « je n'ai pas pu demander »
// ne doit pas se déguiser en « tout va bien » — c'est le mode de panne qui
// nous a coûté deux incidents cette semaine.
import { spawnSync } from "node:child_process";
import { migrationsManquantes, messageEcart } from "./lib/migrations-ecart.mjs";

const r = spawnSync("supabase", ["migration", "list", "--linked", "--output-format", "json"], {
  encoding: "utf8",
});
if (r.error || r.status !== 0) {
  console.error("Impossible d'interroger la production :");
  console.error((r.stderr || r.error?.message || "").trim().slice(0, 500));
  console.error("\nIl faut un projet lié (supabase/.temp/project-ref) et les identifiants");
  console.error("de la base — en CI, les secrets SUPABASE_ACCESS_TOKEN et SUPABASE_DB_PASSWORD.");
  process.exit(2);
}

// La CLI mêle ses avertissements au JSON : on ne garde que la dernière ligne
// qui parse, plutôt que de supposer que la sortie est propre.
//
// Le format se demande avec `--output-format`, PAS avec `-o` : ce dernier
// existe aussi, désigne le format des variables de `status`, et fait rendre un
// tableau markdown à cette commande — mesuré, et silencieusement, puisque la
// commande réussit.
const ligne = r.stdout.trim().split("\n").reverse().find((l) => l.trim().startsWith("{"));
let migrations;
try {
  migrations = JSON.parse(ligne).migrations;
} catch {
  console.error("Réponse illisible de la CLI Supabase :");
  console.error(r.stdout.slice(0, 300));
  process.exit(2);
}

const manquantes = migrationsManquantes(migrations);
console.log(messageEcart(manquantes));
process.exit(manquantes.length === 0 ? 0 : 1);
