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

// Deux façons de poser la question, et la première est la meilleure :
//
// `--db-url` parle à la base et à rien d'autre. `--linked` passe par l'API de
// gestion de Supabase, donc par les DROITS DU COMPTE — mesuré le 2026-09-14 en
// CI : « Your account does not have the necessary privileges to access this
// endpoint », alors que la question posée ne regardait qu'une table de
// migrations. Une vérification qui dépend de privilèges dont elle n'a pas
// besoin est une vérification qui tombera un jour pour une raison hors sujet.
const dbUrl = process.env.SUPABASE_DB_URL;
const args = dbUrl
  ? ["migration", "list", "--db-url", dbUrl, "--output-format", "json"]
  : ["migration", "list", "--linked", "--output-format", "json"];

const r = spawnSync("supabase", args, { encoding: "utf8" });
if (r.error || r.status !== 0) {
  console.error("Impossible d'interroger la production :");
  console.error((r.stderr || r.error?.message || "").trim().slice(0, 500));
  console.error("\nIl faut soit SUPABASE_DB_URL (chaîne de connexion complète, la voie");
  console.error("directe), soit un projet lié dans supabase/.temp/project-ref.");
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
