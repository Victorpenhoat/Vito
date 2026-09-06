// Réapplique au projet Xcode ce que `cap add ios` ne sait pas générer.
//
// `npm run ios:regen` efface `ios/` — le jour où le bundle ID change, tout ce
// qui suit serait perdu en silence. Ce script est donc appelé par `ios:regen`,
// et peut être relancé à tout moment : il est idempotent.
//
//   node scripts/ios-personnaliser.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PLIST = "ios/App/App/Info.plist";
const ENTITLEMENTS = "ios/App/App/App.entitlements";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";

if (!existsSync(PLIST)) {
  console.error("Projet iOS absent — lancer `npx cap add ios --packagemanager SPM` d'abord.");
  process.exit(1);
}

// Le domaine dont iOS confiera les liens à l'app (Universal Links).
const DOMAINE = process.env.CAP_ASSOCIATED_DOMAIN ?? "vito-theta.vercel.app";

// 1. Permissions et langue — sans le texte de localisation, iOS TUE l'app à la
//    première demande de position.
let plist = readFileSync(PLIST, "utf8");
const PERMISSIONS = [
  ["NSLocationWhenInUseUsageDescription",
   "Pour vous montrer les restaurants, hôtels et caves autour de vous sur la carte. Votre position n'est ni enregistrée ni partagée."],
];
for (const [cle, texte] of PERMISSIONS) {
  if (!plist.includes(cle)) {
    plist = plist.replace("<dict>\n", `<dict>\n\t<key>${cle}</key>\n\t<string>${texte}</string>\n`);
    console.log(`Info.plist : ${cle} ajouté`);
  }
}
// `cap add` laisse CFBundleName à « App », le nom de la CIBLE Xcode. C'est ce
// nom-là qui apparaît dans Réglages et dans quelques recoins du système : il
// doit dire Vito, comme l'icône.
plist = plist.replace(
  /(<key>CFBundleName<\/key>\s*\n\s*<string>)[^<]*(<\/string>)/,
  `$1${process.env.CAP_APP_NAME ?? "Vito"}$2`,
);
// L'app est francophone d'abord : c'est la langue de ses textes et de ses
// permissions.
plist = plist.replace(
  /(<key>CFBundleDevelopmentRegion<\/key>\s*\n\s*<string>)[^<]*(<\/string>)/,
  "$1fr$2",
);
writeFileSync(PLIST, plist);

// 2. Universal Links : les domaines revendiqués par l'app.
const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<!-- Universal Links : les domaines dont iOS confie les liens à Vito.
\t     Le domaine doit servir /.well-known/apple-app-site-association (route
\t     Next), et l'app doit être signée par l'équipe qui y est déclarée.
\t     Généré par scripts/ios-personnaliser.mjs — ne pas éditer à la main. -->
\t<key>com.apple.developer.associated-domains</key>
\t<array>
\t\t<string>applinks:${DOMAINE}</string>
\t</array>
</dict>
</plist>
`;
writeFileSync(ENTITLEMENTS, entitlements);
console.log(`App.entitlements : applinks:${DOMAINE}`);

// 3. Rattacher les entitlements aux deux configurations de la cible.
let pbx = readFileSync(PBXPROJ, "utf8");
if (!pbx.includes("CODE_SIGN_ENTITLEMENTS")) {
  pbx = pbx.replace(
    /(\t+)(PRODUCT_BUNDLE_IDENTIFIER = )/g,
    "$1CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n$1$2",
  );
  writeFileSync(PBXPROJ, pbx);
  console.log("project.pbxproj : CODE_SIGN_ENTITLEMENTS rattaché");
}
// 4. Manifeste de confidentialité — obligatoire à la soumission. Le fichier
//    doit être RESSOURCE de la cible, sinon il ne part pas dans le bundle et
//    App Store Connect le réclame après coup.
const REF = "AA00PRIV0000000000000001";
const BUILD = "AA00PRIV0000000000000002";
if (!pbx.includes("PrivacyInfo.xcprivacy")) {
  pbx = pbx
    .replace(
      /(\/\* Begin PBXBuildFile section \*\/\n)/,
      `$1\t\t${BUILD} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${REF} /* PrivacyInfo.xcprivacy */; };\n`,
    )
    .replace(
      /(\/\* Begin PBXFileReference section \*\/\n)/,
      `$1\t\t${REF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n`,
    )
    // Dans le groupe « App », à côté d'Info.plist.
    .replace(
      /(\t+)([0-9A-F]{24} \/\* Info\.plist \*\/,\n)/,
      `$1$2$1${REF} /* PrivacyInfo.xcprivacy */,\n`,
    )
    // Et dans la phase Resources, pour être copié dans le bundle.
    .replace(
      /(\t+)([0-9A-F]{24} \/\* Assets\.xcassets in Resources \*\/,\n)/,
      `$1$2$1${BUILD} /* PrivacyInfo.xcprivacy in Resources */,\n`,
    );
  writeFileSync(PBXPROJ, pbx);
  console.log("project.pbxproj : PrivacyInfo.xcprivacy ajouté aux ressources");
}

console.log("Personnalisation iOS appliquée.");
