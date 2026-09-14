// Dit si la configuration d'auth d'un projet distant correspond encore à celle
// que le dépôt déclare — pour les quelques réglages dont un écart est une PANNE.
//
//   npm run config:derive -- <project-ref>       (ou $SUPABASE_PROJECT_REF)
//
// Sort 0 quand rien ne dérive, 1 quand un réglage surveillé diverge, 2 quand la
// question n'a pas pu être posée (pas de jeton, réseau, réponse illisible). Ces
// trois issues sont distinctes exprès, pour la même raison que prod-ecart.mjs :
// « je n'ai pas pu demander » ne doit jamais se déguiser en « tout va bien ».
//
// C'est précisément ce déguisement qui a laissé le hook custom_access_token
// débranché en prod et en staging sans que personne le sache.
//
// N'a besoin QUE de SUPABASE_ACCESS_TOKEN : `config diff` interroge l'API de
// management et ne se connecte pas à la base. Pas de lien à poser, donc pas de
// `supabase/.temp/project-ref` modifié — un état partagé entre checkouts.
import { spawnSync } from "node:child_process";
import { extraireDiff, derivesInterdites, messageDerive, estSousCommandeInconnue } from "./lib/config-derive.mjs";

const ref = process.argv[2] || process.env.SUPABASE_PROJECT_REF;
if (!ref) {
  console.error("Usage : npm run config:derive -- <project-ref>");
  console.error("ou définir SUPABASE_PROJECT_REF. Le jeton vient de SUPABASE_ACCESS_TOKEN");
  console.error("(ou du trousseau, après `supabase login`).");
  process.exit(2);
}

// Le format se demande avec `--output-format`, PAS avec `-o` : ce dernier existe
// aussi, désigne le format des variables de `status`, et ne rend pas le même
// document. Piège relevé par la session voisine sur `migration list`.
const args = ["config", "diff", "--project-ref", ref, "--output-format", "json"];
const lancer = (bin, extra = []) => spawnSync(bin, [...extra, ...args], { encoding: "utf8" });

// `config diff` n'existe qu'à partir de la 2.117.0. Une CLI plus ancienne ne dit
// pas « commande inconnue » : elle rend son AIDE avec un statut non nul. On se
// rabat alors sur npx, comme le fait déjà scripts/supabase.mjs quand le binaire
// manque — sans quoi le message enverrait chercher un jeton qui ne manque pas.
let r = lancer("supabase");
if (r.error?.code === "ENOENT" || estSousCommandeInconnue((r.stdout ?? "") + (r.stderr ?? ""))) {
  r = lancer("npx", ["supabase"]);
}

if (r.error || r.status !== 0) {
  console.error(`Impossible d'interroger la configuration de ${ref} :`);
  if (estSousCommandeInconnue((r.stdout ?? "") + (r.stderr ?? ""))) {
    console.error("la CLI Supabase ne connaît pas `config diff` — il faut la 2.117.0 ou plus");
    console.error("(la CI l'épingle ; en local, `npm i -g supabase@latest` ou `npx supabase`).");
  } else {
    console.error((r.stderr || r.error?.message || "").trim().slice(0, 500));
    console.error("\nIl faut un jeton de management — en CI, le secret SUPABASE_ACCESS_TOKEN.");
  }
  process.exit(2);
}

let diff;
try {
  diff = extraireDiff(r.stdout);
} catch (e) {
  console.error(e.message.slice(0, 500));
  process.exit(2);
}

const derives = derivesInterdites(diff);
console.log(messageDerive(derives, ref));
process.exit(derives.length === 0 ? 0 : 1);
