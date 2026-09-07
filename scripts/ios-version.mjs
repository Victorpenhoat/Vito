// Aligne la version de l'app iOS sur celle du repo, et incrémente le numéro de
// build.
//
// Deux nombres, deux rôles :
//
// - MARKETING_VERSION (CFBundleShortVersionString) = la version que voit
//   l'utilisateur. Elle vient de package.json : une seule source, pas deux
//   vérités qui divergent au fil des lots.
// - CURRENT_PROJECT_VERSION (CFBundleVersion) = le numéro de build. App Store
//   Connect REFUSE un envoi dont le numéro n'a pas augmenté, et l'erreur arrive
//   après plusieurs minutes d'upload. Il s'incrémente donc ici, avant l'archive.
//
//   npm run ios:version
import { readFileSync, writeFileSync } from "node:fs";

const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
let pbx = readFileSync(PBXPROJ, "utf8");

const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => Number(m[1]));
const suivant = Math.max(0, ...builds) + 1;

pbx = pbx
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${suivant};`);
writeFileSync(PBXPROJ, pbx);

console.log(`Vito ${version} (build ${suivant})`);
