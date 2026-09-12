import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SRC, fichiersSources, sansCommentaires } from "./fichiersSources";

// Une pastille dessinée à la main est la dette que le lot 6 supprime : 107
// copies existaient dans 65 fichiers, et rien n'empêchait la 108e. `rounded-pill`
// seul ne suffit pas à incriminer — c'est la conjonction avec un padding
// horizontal qui fait une pastille plutôt qu'un rond.
//
// Le motif accepte les deux ordres : `rounded-pill ... px-4` (le rayon avant
// le padding) ET `px-4 ... rounded-pill` (un ternaire de classes, ou un
// padding composé avant le rayon, met parfois le padding en premier). Un seul
// des deux ordres laissait passer une pastille faite main sans que ce
// garde-fou ne la voie. `[^>]` et non `[\s\S]` : la fenêtre reste À L'INTÉRIEUR
// d'une balise JSX. Un `[\s\S]{0,200}` sans borne franchit le `>` qui ferme la
// balise et va chercher son padding dans l'élément SUIVANT — mesuré sur
// l'arbre, ça incrimine à tort un avatar `rounded-full` sans padding pour le
// seul crime d'être à moins de 200 caractères d'un `px-` appartenant à un
// tout autre élément (`ListeActivites.tsx`, `ProchesEmptyState.tsx`). Vérifié
// après coup : avec `[^>]`, l'ensemble des fichiers incriminés est identique à
// celui de l'ancien motif.
const PASTILLE = /rounded-(pill|full)[^>]{0,200}?\bpx-|\bpx-[^>]{0,200}?rounded-(pill|full)/;

// Liste CLOSE. Chaque entrée porte sa raison.
//
// Seuls les composants que le motif attrape RÉELLEMENT figurent ici. Vérifié
// sur l'arbre : ViewSwitcher et SearchField n'y sont pas, leurs éléments ronds
// n'ayant pas de padding horizontal. Les y inscrire « au cas où » accorderait
// d'avance une permission que personne n'aurait examinée — c'est précisément la
// dérive que ce garde-fou existe pour empêcher.
const AUTORISES: Record<string, string> = {
  "features/shared/ui/TagChip.tsx": "le composant lui-même",
  "features/shared/ui/SubTabPills.tsx": "le composant lui-même",
  "features/shared/ui/CountBadge.tsx": "le composant lui-même",
  "features/places/ui/CategoryMap.tsx":
    "bouton d'action flottant sur la carte (« Autour de moi »), rond par commodité et non pastille",
  "features/places/ui/CategoryMapCombined.tsx": "idem, carte combinée",
  "features/vins/ui/CaveMap.tsx": "idem, carte de la cave",
  "features/activites/ui/CarteActivites.tsx": "idem, carte des activités",
};

// TEMPORAIRE. Relevé par ce test même, pas à la main : 57 fichiers dessinent
// encore leurs pastilles. Le lot indiqué n'est pas « quelle famille domine »
// mais « quand ce fichier sortira-t-il en une fois » — le second test exige
// qu'une entrée retirée n'ait PLUS AUCUNE pastille, donc un fichier mixte va au
// lot le plus tardif. Le commentaire `n/m interactives` donne le comptage.
//
// C'est une heuristique de fenêtre, pas une mesure : elle cherche `<button`,
// `aria-pressed`, `onClick` ou un ternaire de classe autour de chaque pastille.
// À vérifier au cas par cas en 6B-2 et 6B-3 ; elle ordonne le travail, elle ne
// le dispense pas.
const DETTE: Record<string, string> = {
  "features/activites/ui/FicheActivite.tsx": "6B-3", // 1/2 interactives
  "features/activites/ui/FiltresActivites.tsx": "6B-3", // 1/2 interactives
  "features/activites/ui/FormulaireActivite.tsx": "6B-2", // 2/2 interactives
  "features/activites/ui/GrilleSemaine.tsx": "6B-3", // 0/3 interactives
  "features/activites/ui/LigneActivite.tsx": "6B-3", // 0/1 interactives
  "features/activites/ui/SectionCout.tsx": "6B-3", // 0/1 interactives
  "features/activites/ui/SectionDocuments.tsx": "6B-3", // 0/1 interactives
  "features/activites/ui/SousOnglets.tsx": "6B-2", // 1/1 interactives
  "features/activites/ui/StatutActivite.tsx": "6B-3", // 0/1 interactives
  "features/activites/ui/VueSemaine.tsx": "6B-3", // 0/4 interactives
  "features/compte/ui/ComptesTable.tsx": "6B-2", // 2/2 interactives
  "features/compte/ui/ReglagesSections.tsx": "6B-3", // 0/1 interactives
  "features/compte/ui/SessionsSection.tsx": "6B-3", // 1/2 interactives
  "features/compte/ui/TotpSection.tsx": "6B-3", // 0/1 interactives
  "features/compte/ui/VerrouForm.tsx": "6B-2", // 1/1 interactives
  "features/conciergerie/ui/DemandesList.tsx": "6B-2", // 1/1 interactives
  "features/famille/ui/CercleList.tsx": "6B-3", // 0/1 interactives
  "features/famille/ui/CompteProcheBlock.tsx": "6B-3", // 0/1 interactives
  "features/famille/ui/DocumentTunnel.tsx": "6B-2", // 3/3 interactives
  "features/famille/ui/ExpiryBadge.tsx": "6B-3", // 0/1 interactives
  "features/famille/ui/FamilleRail.tsx": "6B-3", // 0/1 interactives
  "features/famille/ui/FichePersonne.tsx": "6B-3", // 0/1 interactives
  "features/famille/ui/ProcheForm.tsx": "6B-2", // 2/2 interactives
  "features/places/ui/CategoryDiscovery.tsx": "6B-3", // 3/4 interactives
  // Les sous-onglets, le champ, le commutateur et les 4 groupes de filtres SONT
  // migrés (lot 6B-1). Restent 3 pastilles d'une autre nature : une chip
  // descriptive teintée que TagChip ne sait pas rendre, et deux BOUTONS
  // D'ACTION ronds (« marquer la visite », « passer en favori ») qui ne sont pas
  // des chips. L'heuristique les comptait « interactives » ; elle confondait
  // pastille interactive et bouton d'action en forme de pastille.
  "features/places/ui/CategoryTabs.tsx": "6B-3", // 3 restantes, dont 2 boutons d'action
  "features/places/ui/ExperienceForm.tsx": "6B-2", // 2/2 interactives
  "features/places/ui/SejourContexteChips.tsx": "6B-2", // 1/1 interactives
  "features/places/ui/SejoursAVenirBlock.tsx": "6B-2", // 2/2 interactives
  "features/reception/ui/ReceptionList.tsx": "6B-2", // 2/2 interactives
  "features/reception/ui/RecommanderButton.tsx": "6B-3", // 1/2 interactives
  "features/reco/ui/RechercheForm.tsx": "6B-2", // 1/1 interactives
  "features/restos/ui/FicheResto.tsx": "6B-3", // 0/1 interactives
  "features/restos/ui/OrigineForm.tsx": "6B-2", // 1/1 interactives
  "features/restos/ui/StatutChip.tsx": "6B-2", // 1/1 interactives
  "features/restos/ui/TagsAdmin.tsx": "6B-2", // 1/1 interactives
  "features/shared/ui/NavItem.tsx": "6B-2", // 1/1 interactives
  "features/shared/ui/SectionLabel.tsx": "6B-3", // 0/1 interactives
  "features/shell/ui/Introuvable.tsx": "6B-3", // 0/1 interactives
  "features/vins/ui/CavePanel.tsx": "6B-3", // 3/4 interactives
  "features/vins/ui/CaveStatsPanel.tsx": "6B-2", // 1/1 interactives
  "features/vins/ui/CorrectionAnalyse.tsx": "6B-3", // 1/2 interactives
  "features/vins/ui/EtiquetteTunnel.tsx": "6B-2", // 1/1 interactives
  "features/vins/ui/MaDegustationForm.tsx": "6B-2", // 5/5 interactives
  "features/vins/ui/VinFiche.tsx": "6B-3", // 0/3 interactives
  "features/voyages/ui/DepensesVoyageBlock.tsx": "6B-2", // 2/2 interactives
  "features/voyages/ui/DocumentsList.tsx": "6B-2", // 1/1 interactives
  "features/voyages/ui/ParticipantsList.tsx": "6B-2", // 4/4 interactives
  "features/voyages/ui/PiecesJointes.tsx": "6B-3", // 0/1 interactives
  "features/voyages/ui/PlanningCalendrier.tsx": "6B-3", // 0/3 interactives
  "features/voyages/ui/PlanningFrise.tsx": "6B-3", // 0/1 interactives
  "features/voyages/ui/ProgrammeBlock.tsx": "6B-3", // 0/1 interactives
  "features/voyages/ui/VoyageDetail.tsx": "6B-3", // 2/4 interactives
  "features/voyages/ui/VoyagesList.tsx": "6B-3", // 1/3 interactives
  "app/[locale]/(app)/abonnement/page.tsx": "6B-3", // 0/1 interactives
  "app/[locale]/(app)/conciergerie/page.tsx": "6B-3", // 0/1 interactives
  "app/[locale]/(app)/voyages/page.tsx": "6B-3", // 0/1 interactives
  "app/[locale]/(app)/activites/alertes/page.tsx": "6B-3", // 0/1 interactives
};

const coupables = (connus: Record<string, string>) =>
  fichiersSources()
    .filter((f) => f.startsWith("features/") || f.startsWith("app/"))
    .filter((f) => !(f in connus))
    .filter((f) => PASTILLE.test(sansCommentaires(readFileSync(path.join(SRC, f), "utf8"))))
    .sort();

describe("les pastilles", () => {
  it("ne sont dessinées à la main nulle part", () => {
    expect(coupables({ ...AUTORISES, ...DETTE })).toEqual([]);
  });

  // Une dette qu'on oublie de vider redevient une liste d'exceptions, et la
  // dette est alors payée sans que personne ne le sache. Ce test force à retirer
  // chaque entrée au moment où sa tâche la règle.
  //
  // Un fichier de `DETTE` peut aussi disparaître (renommage, suppression) sans
  // que l'entrée soit retirée : `readFileSync` lèverait alors ENOENT et ferait
  // planter tout le test, masquant les vraies entrées payées derrière une
  // erreur de plomberie. `existsSync` transforme ce cas en une entrée obsolète
  // détectée comme telle, avec un message clair plutôt qu'un crash.
  it("ne gardent aucune dette déjà payée", () => {
    const payees = Object.keys(DETTE)
      .filter((f) => {
        const chemin = path.join(SRC, f);
        if (!existsSync(chemin)) return true; // entrée obsolète : fichier renommé ou supprimé
        return !PASTILLE.test(sansCommentaires(readFileSync(chemin, "utf8")));
      })
      .sort();
    expect(payees, "entrée(s) de DETTE obsolète(s) ou payée(s) — à retirer de la liste").toEqual([]);
  });
});
