// Passe-plat vers la CLI Supabase, en visant la pile de CE worktree quand elle
// existe (`.supabase-local/`, créé par `npm run supabase:worktree`).
//
// Sans ce passe-plat, il faudrait penser à exporter SUPABASE_WORKDIR dans
// chaque shell — et un oubli ne se voit pas : la commande réussit, sur la base
// du voisin.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const racine = process.cwd();
const dossier = path.join(racine, ".supabase-local");
const env = { ...process.env };
if (existsSync(dossier)) env.SUPABASE_WORKDIR = dossier;

const r = spawnSync("supabase", process.argv.slice(2), { stdio: "inherit", env, shell: false });
if (r.error?.code === "ENOENT") {
  const npx = spawnSync("npx", ["supabase", ...process.argv.slice(2)], { stdio: "inherit", env });
  process.exit(npx.status ?? 1);
}
process.exit(r.status ?? 1);
