// Donne à ce worktree sa PROPRE pile Supabase locale.
//
//   npm run supabase:worktree
//
// Pourquoi : `supabase db reset` rejoue les migrations du disque de celui qui
// lance la commande. Tant que deux worktrees partagent une pile, le reset de
// l'un efface la migration en cours d'écriture de l'autre — c'est arrivé
// quatre fois en deux heures le 2026-09-12, dont deux fois par des commandes
// de courtoisie (« laisser la base propre en partant »). Le partage implicite
// rend la discipline insuffisante.
//
// Comment : la CLI accepte `SUPABASE_WORKDIR`, donc on lui fait lire une
// configuration déportée dans `.supabase-local/` (ignoré par git), avec un
// `project_id` et des ports à soi. Les migrations, le seed et les gabarits y
// sont des LIENS vers ceux du worktree : pas de copie qui dériverait, et la
// CLI les suit (vérifié au spike du 2026-09-12).
//
// Les clés anon et service ne changent pas — elles dérivent du secret JWT,
// identique d'une pile à l'autre. Seul le port de l'URL change dans .env.local.
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { decalagePour, configPatchee, envPatche, DECALAGES_MAX } from "./lib/worktree-ports.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const racine = git("rev-parse", "--show-toplevel");
const commun = path.resolve(git("rev-parse", "--git-common-dir"));
const propre = path.resolve(git("rev-parse", "--git-dir"));

// Le checkout principal garde la pile par défaut : sans quoi on déplacerait la
// base de tout le monde, y compris celle des sessions qui ne demandent rien.
if (commun === propre) {
  console.error("Ce checkout est le principal : il garde la pile par défaut (ports 543xx).");
  console.error("Lancez cette commande depuis un worktree (git worktree add …).");
  process.exit(1);
}

const nom = path.basename(racine);
const dossier = path.join(racine, ".supabase-local");

// Décalages déjà pris par les AUTRES piles : on lit les ports réellement
// publiés par Docker plutôt que de tenir un registre, qu'il faudrait
// synchroniser entre worktrees et qui mentirait au premier `docker rm`.
//
// « Les autres » n'est pas un détail : au second passage, une pile déjà
// démarrée pour CE worktree se comptait elle-même comme occupée et le script
// déménageait ses ports — mesuré le 2026-09-13. Un worktree doit retrouver sa
// pile, toujours.
function decalagesOccupes(projectId) {
  let lignes = "";
  try {
    lignes = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Ports}}"], {
      encoding: "utf8",
    });
  } catch {
    return []; // pas de Docker joignable : rien à éviter, le démarrage dira le reste
  }
  const ports = new Set();
  for (const ligne of lignes.split("\n")) {
    const [nomConteneur = "", publies = ""] = ligne.split("\t");
    if (nomConteneur.endsWith(`_${projectId}`)) continue;
    for (const m of publies.matchAll(/:(\d{4,5})->/g)) ports.add(Number(m[1]));
  }
  const occupes = [];
  for (let i = 1; i <= DECALAGES_MAX; i++) {
    // l'API est le port le plus sûr à sonder : toute pile en publie un
    if (ports.has(54321 + 100 * i)) occupes.push(100 * i);
  }
  return occupes;
}

const projectId = `Vito-${nom}`;
const decalage = decalagePour(nom, decalagesOccupes(projectId));

rmSync(dossier, { recursive: true, force: true });
mkdirSync(path.join(dossier, "supabase"), { recursive: true });

const config = configPatchee(readFileSync(path.join(racine, "supabase/config.toml"), "utf8"), {
  projectId,
  decalage,
});
writeFileSync(path.join(dossier, "supabase/config.toml"), config);

for (const cible of ["migrations", "seed.sql", "templates", "tests"]) {
  const source = path.join(racine, "supabase", cible);
  if (existsSync(source)) symlinkSync(source, path.join(dossier, "supabase", cible));
}

// .env.local : seuls les ports changent (les clés dérivent du même secret JWT).
// Le fichier est ignoré par git, donc propre au worktree — on ne touche jamais
// à celui du checkout principal.
const env = path.join(racine, ".env.local");
const portE2e = 3001 + decalage / 100;
if (existsSync(env)) {
  writeFileSync(env, envPatche(readFileSync(env, "utf8"), { decalage }));
} else {
  console.warn("Pas de .env.local ici : copiez celui du checkout principal, puis relancez.");
}

console.log(`Pile « ${projectId} » : API ${54321 + decalage}, base ${54322 + decalage}, Studio ${54323 + decalage}.`);
console.log(`Playwright de ce worktree : port ${portE2e}.`);
console.log("Démarrez la pile avec : npm run db:start   (puis npm run db:reset pour le seed)");
