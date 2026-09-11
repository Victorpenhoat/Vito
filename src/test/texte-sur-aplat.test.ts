import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources, sansCommentaires } from "./fichiersSources";

// `--on-fill` est le rôle du texte posé sur un aplat, et il s'inverse avec le
// thème. `text-white` ne s'inverse pas : c'est la façon de contourner le rôle
// sans qu'aucun test ne bronche. C'est ainsi que le basculement du défaut en
// sombre (lot 0) a fait passer trois familles d'aplats de conformes à
// illisibles d'un coup — blanc sur --ink donne 1,12:1.
//
// Liste CLOSE et DÉFINITIVE. Chaque entrée porte la MESURE qui la justifie.
const AUTORISES: Record<string, string> = {
  "features/shared/ui/Avatar.tsx":
    "le fond est une teinte de la palette d'avatars : le blanc y tient 4,47 à 5,88:1, --on-fill n'y ferait que 3,19 à 4,19:1",
  "features/activites/ui/ListeActivites.tsx":
    "pastille sur la couleur du membre (même palette que les avatars)",
  "features/activites/ui/CarteActivites.tsx":
    "pastille sur la couleur du membre (même palette que les avatars)",
  "features/activites/ui/VueSemaine.tsx":
    "pastille sur la couleur du membre (même palette que les avatars)",
  "features/voyages/ui/VoyageDetail.tsx":
    "surimpression sur la photo de couverture, sous un dégradé noir",
  "features/vins/ui/VinFiche.tsx":
    "surimpression sur l'aplat de couleur du vin, sous un dégradé noir",
  "features/restos/ui/FicheResto.tsx":
    "surimpression sur la photo de l'établissement, sous un dégradé noir",
  "features/places/ui/PlaceCard.tsx":
    "le fond est la couleur de tag choisie par l'utilisateur : aucun rôle ne peut la prévoir",
};

// TEMPORAIRE. Ce que le lot 6A n'a pas encore migré, et la tâche qui l'emporte.
// Relevé par ce test même, pas à la main : un premier comptage au `grep`
// filtrait sur `px-|py-` et manquait les boutons ronds, d'où seize fichiers
// annoncés au plan pour vingt-cinq réels.
const DETTE: Record<string, string> = {
  // tâche 6 — les aplats d'accent recopiés à la main
  "app/[locale]/(app)/abonnement/page.tsx": "tâche 6",
  "app/[locale]/(app)/famille/page.tsx": "tâche 6",
  "app/[locale]/(app)/voyages/page.tsx": "tâche 6",
  "app/[locale]/(auth)/inscription/page.tsx": "tâche 6",
  "features/auth/ui/AuthPanel.tsx": "tâche 6",
  "features/auth/ui/BoutonPasskey.tsx": "tâche 6",
  "features/auth/ui/ConnexionPanel.tsx": "tâche 6",
  "features/famille/ui/DocumentTunnel.tsx": "tâche 6",
  "features/invitations/ui/CreerCompteTunnel.tsx": "tâche 6",
  "features/places/ui/CategoryTabs.tsx": "tâche 6",
  "features/places/ui/SejourContexteChips.tsx": "tâche 6",
  "features/restos/ui/TagsAdmin.tsx": "tâche 6",
  "features/restos/ui/VisiteCta.tsx": "tâche 6",
  "features/vins/ui/BuyButton.tsx": "tâche 6",
  "features/voyages/ui/DepensesVoyageBlock.tsx": "tâche 6",
  "features/voyages/ui/ModeVoyageBlock.tsx": "tâche 6",
  "features/voyages/ui/PlanningCalendrier.tsx": "tâche 6",
  "features/voyages/ui/PlanningFrise.tsx": "tâche 6",
  "features/voyages/ui/VoyagesList.tsx": "tâche 6",
};

describe("sansCommentaires", () => {
  // Le garde-fou ci-dessous serait inexplicable sans ça : le commentaire qui
  // dit « n'écrivez pas text-white » compterait comme un text-white, et
  // maintiendrait son fichier en dette une fois celle-ci payée. C'est arrivé.
  it("retire les lignes et les blocs commentés", () => {
    const src = [
      "// text-white interdit ici",
      "  * text-white dans un bloc jsdoc",
      "/* text-white en bloc */",
      'const a = "text-on-fill";',
    ].join("\n");
    expect(sansCommentaires(src)).not.toMatch(/text-white/);
    expect(sansCommentaires(src)).toContain("text-on-fill");
  });

  // Un `//` en milieu de ligne est presque toujours un `https://`. Le traiter
  // comme un commentaire masquerait tout ce qui le suit — un garde-fou aveugle
  // est pire qu'aucun garde-fou.
  it("ne coupe pas une ligne sur le // d'une URL", () => {
    const src = 'const u = "https://x.test"; const c = "text-white";';
    expect(sansCommentaires(src)).toContain("text-white");
  });
});

describe("le texte posé sur un aplat", () => {
  it("n'emploie `text-white` que là où aucun rôle ne convient", () => {
    const connus = { ...AUTORISES, ...DETTE };
    const coupables = fichiersSources()
      .filter((f) => !(f in connus))
      .filter((f) => /\btext-white\b/.test(sansCommentaires(readFileSync(path.join(SRC, f), "utf8"))))
      .sort();
    expect(coupables).toEqual([]);
  });

  // Une liste de dette qu'on oublie de vider redevient une liste d'exceptions,
  // et la dette est alors payée sans que personne ne le sache. Ce test force à
  // retirer chaque entrée au moment où sa tâche la règle.
  it("ne garde aucune dette déjà payée", () => {
    const payees = Object.keys(DETTE)
      .filter((f) => !/\btext-white\b/.test(sansCommentaires(readFileSync(path.join(SRC, f), "utf8"))))
      .sort();
    expect(payees).toEqual([]);
  });
});
