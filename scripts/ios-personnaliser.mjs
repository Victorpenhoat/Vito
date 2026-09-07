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
const PRIVACY = "ios/App/App/PrivacyInfo.xcprivacy";

/** Manifeste de confidentialité — voir le commentaire de l'étape 5. */
const MANIFESTE_CONFIDENTIALITE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<!-- Vito ne suit personne : aucune régie, aucun identifiant publicitaire,
	     aucune donnée recoupée avec un tiers à des fins de ciblage. -->
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyTrackingDomains</key>
	<array/>

	<!-- Aucune « API à raison requise » n'est appelée par du code natif : l'app
	     n'a pas de code Swift propre, et Capacitor déclare son propre manifeste
	     (vide lui aussi). -->
	<key>NSPrivacyAccessedAPITypes</key>
	<array/>

	<key>NSPrivacyCollectedDataTypes</key>
	<array>
		<!-- Adresse e-mail : c'est l'identifiant du compte, et la seule voie
		     par laquelle un lien de connexion arrive. -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypeEmailAddress</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<true/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
		<!-- Nom affiché, facultatif : pour se reconnaître entre proches d'un
		     même carnet. -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypeName</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<true/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
		<!-- Identifiant de compte, créé par Vito. -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypeUserID</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<true/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
		<!-- Position précise : lue au moment où l'on demande « autour de moi »,
		     jamais enregistrée ni envoyée ailleurs. Non rattachée au compte,
		     puisqu'elle n'est stockée nulle part. -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypePreciseLocation</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<false/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
		<!-- Le carnet lui-même : adresses, notes, photos, documents. C'est le
		     contenu que l'utilisateur crée, et la raison d'être de l'app. -->
		<dict>
			<key>NSPrivacyCollectedDataType</key>
			<string>NSPrivacyCollectedDataTypeOtherUserContent</string>
			<key>NSPrivacyCollectedDataTypeLinked</key>
			<true/>
			<key>NSPrivacyCollectedDataTypeTracking</key>
			<false/>
			<key>NSPrivacyCollectedDataTypePurposes</key>
			<array>
				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
`;

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
// 4. Cible iOS minimale. Capacitor génère 15.0 ; on vise 16.0 (décision PO du
//    2026-09-06) : WebAuthn y est mûr — les passkeys sont la voie de connexion
//    la plus soignée de Vito — et les safe areas s'y tiennent sans contorsion.
const CIBLE = process.env.CAP_IOS_TARGET ?? "16.0";
if (!pbx.includes(`IPHONEOS_DEPLOYMENT_TARGET = ${CIBLE};`)) {
  pbx = pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/g, `IPHONEOS_DEPLOYMENT_TARGET = ${CIBLE};`);
  writeFileSync(PBXPROJ, pbx);
  console.log(`project.pbxproj : cible iOS ${CIBLE}`);
}

// 5. Manifeste de confidentialité — obligatoire à la soumission.
//
//    Il est ÉCRIT ici, pas seulement référencé : `ios:regen` fait `rm -rf ios`,
//    et un projet qui pointe sur un fichier absent ne compile pas. C'est
//    arrivé.
//
//    Le fichier doit aussi être RESSOURCE de la cible, sinon il ne part pas
//    dans le bundle et App Store Connect le réclame après coup.
writeFileSync(PRIVACY, MANIFESTE_CONFIDENTIALITE);
console.log("PrivacyInfo.xcprivacy écrit");
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

// Le manifeste lui-même. Déclare ce que l'app collecte — et surtout qu'elle
// ne suit personne. Toute évolution du produit doit passer par ici.
