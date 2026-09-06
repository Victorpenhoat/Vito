// Génère la source unique des icônes et écrans de lancement.
//
// Il n'y en avait aucune : `public/icon-192.png` et `icon-512.png` étaient des
// images de 1×1 pixel — le manifeste PWA pointait sur du vide depuis le début.
//
// Le rendu passe par le Chromium de Playwright, déjà installé pour les tests :
// pas de dépendance graphique de plus pour quatre images.
//
//   node scripts/generer-icones.mjs
//
// Puis `npm run ios:assets` décline les tailles iOS depuis `assets/`.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

// Tokens du thème clair (src/app/globals.css) — la coque et le web disent la
// même chose.
const PAPIER = "#FBF9F3";
const ENCRE = "#211E1A";
const OR = "#E9B949";

/** Le V du carnet : couverture encre, lettre papier, filet d'or. */
const marque = ({ fond, lettre, filet, taille }) => `
  <div style="width:${taille}px;height:${taille}px;background:${fond};
              display:flex;align-items:center;justify-content:center;position:relative;">
    <span style="font-family:Newsreader,Georgia,'Times New Roman',serif;
                 font-size:${taille * 0.62}px;line-height:1;color:${lettre};
                 letter-spacing:-0.02em;transform:translateY(-2%);">V</span>
    <span style="position:absolute;bottom:${taille * 0.17}px;width:${taille * 0.26}px;
                 height:${Math.max(2, taille * 0.018)}px;background:${filet};
                 border-radius:${taille}px;"></span>
  </div>`;

const IMAGES = [
  // Icône : couverture sombre, lettre claire — lisible à 60 px sur un écran
  // d'accueil, quel que soit le fond d'écran.
  { fichier: "assets/icon-only.png", taille: 1024,
    html: marque({ fond: ENCRE, lettre: PAPIER, filet: OR, taille: 1024 }) },
  // Écran de lancement : le papier du carnet, comme l'app au démarrage.
  { fichier: "assets/splash.png", taille: 2732,
    html: marque({ fond: PAPIER, lettre: ENCRE, filet: OR, taille: 2732 }) },
  { fichier: "assets/splash-dark.png", taille: 2732,
    html: marque({ fond: ENCRE, lettre: PAPIER, filet: OR, taille: 2732 }) },
  // Icônes du manifeste PWA : même source, pour que le web et l'app ne
  // divergent pas.
  { fichier: "public/icon-512.png", taille: 512,
    html: marque({ fond: ENCRE, lettre: PAPIER, filet: OR, taille: 512 }) },
  { fichier: "public/icon-192.png", taille: 192,
    html: marque({ fond: ENCRE, lettre: PAPIER, filet: OR, taille: 192 }) },
];

const navigateur = await chromium.launch();
await mkdir("assets", { recursive: true });
for (const { fichier, taille, html } of IMAGES) {
  const page = await navigateur.newPage({ viewport: { width: taille, height: taille } });
  await page.setContent(`<body style="margin:0">${html}</body>`);
  // Les polices web ne sont pas chargées ici : la pile de repli (Georgia) est
  // celle du thème, le rendu reste celui du carnet.
  await page.screenshot({ path: fichier });
  await page.close();
  console.log(`${fichier} — ${taille}×${taille}`);
}
await navigateur.close();
