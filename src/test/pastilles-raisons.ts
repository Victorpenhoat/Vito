/**
 * Pourquoi chaque pastille dessinée à la main existe encore.
 *
 * Une entrée par fichier, une raison par site, **dans l'ordre des lignes**. Le
 * garde-fou (`pastilles-faites-main.test.ts`) compare ce nombre au nombre de
 * pastilles réellement présentes : en ajouter une sans écrire sa raison fait
 * échouer la suite, en retirer une sans retirer sa raison aussi.
 *
 * Une raison qui commence par `dette:` annonce un site qui DOIT migrer. Toutes
 * les autres sont définitives : ce sont des éléments légitimement ronds, pas des
 * chips. Le lot 6 a commencé en croyant migrer 107 pastilles ; en les lisant une
 * par une, l'écrasante majorité sont des boutons d'action, des liens de
 * navigation, des contrôles de formulaire ou des badges descriptifs.
 *
 * **Ne jamais annoter au jugé.** Une raison fausse est pire que pas de raison :
 * elle éteint le garde-fou en prétendant l'avoir consulté.
 */
export const RAISONS: Record<string, string[]> = {
  // ── Le kit lui-même ────────────────────────────────────────────────────────
  "features/shared/ui/CountBadge.tsx": ["le composant lui-même"],
  "features/shared/ui/SubTabPills.tsx": ["le composant lui-même"],
  "features/shared/ui/TagChip.tsx": ["le composant lui-même"],
  "features/shared/ui/SectionLabel.tsx": ["la pastille de compteur du composant lui-même"],
  "features/shared/ui/NavItem.tsx": ["dette: 6B-3 — compteur de navigation, candidat à CountBadge"],

  // ── Écrans d'application ───────────────────────────────────────────────────
  "app/[locale]/(app)/abonnement/page.tsx": ["dette: 6B-3 — badge « premium », candidat à CountBadge"],
  "app/[locale]/(app)/activites/alertes/page.tsx": ["dette: 6B-3 — badge d'urgence teinté, candidat à TagChip statique"],
  "app/[locale]/(app)/conciergerie/page.tsx": ["dette: 6B-3 — badge « premium », candidat à CountBadge"],
  "app/[locale]/(app)/voyages/page.tsx": ["lien de navigation vers le planning, pas un chip"],

  // ── Activités ──────────────────────────────────────────────────────────────
  "features/activites/ui/CarteActivites.tsx": ["bouton flottant superposé à la carte (« Autour de moi »)"],
  "features/activites/ui/FicheActivite.tsx": [
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
  ],
  "features/activites/ui/FiltresActivites.tsx": [
    "lien qui RETIRE un filtre posé (href), pas un chip cliquable",
    "lien de filtre (aria-current + href) : c'est une URL, pas un état client",
  ],
  "features/activites/ui/FormulaireActivite.tsx": [
    "bouton d'action qui ouvre le champ de création",
    "contrôle de formulaire — <label> enveloppant un radio masqué",
  ],
  "features/activites/ui/GrilleSemaine.tsx": [
    "dette: 6B-3 — badge de conflit, candidat à TagChip statique",
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
    "dette: 6B-3 — badge de vacances, candidat à TagChip statique",
  ],
  "features/activites/ui/LigneActivite.tsx": ["dette: 6B-3 — badge de statut, candidat à TagChip statique"],
  "features/activites/ui/SectionCout.tsx": ["dette: 6B-3 — badge de montant, candidat à TagChip statique"],
  "features/activites/ui/SectionDocuments.tsx": ["dette: 6B-3 — badge de document, candidat à TagChip statique"],
  "features/activites/ui/SousOnglets.tsx": ["sous-onglets par LIEN (aria-current) : migrer perdrait le clic milieu et le retour arrière"],
  "features/activites/ui/StatutActivite.tsx": ["dette: 6B-3 — badge de statut, candidat à TagChip statique"],
  "features/activites/ui/VueSemaine.tsx": [
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
    "dette: 6B-3 — badge « séance manquée », candidat à TagChip statique",
    "dette: 6B-3 — badge « vacances », candidat à TagChip statique",
  ],

  // ── Compte ─────────────────────────────────────────────────────────────────
  "features/compte/ui/ComptesTable.tsx": [
    "dette: 6B-3 — badge de rôle, candidat à TagChip statique",
    "bouton de formulaire (type=submit) : TagChip ne rend que type=button",
  ],
  "features/compte/ui/ReglagesSections.tsx": ["dette: 6B-3 — badge descriptif, candidat à TagChip statique"],
  "features/compte/ui/SessionsSection.tsx": [
    "dette: 6B-3 — badge « session courante », candidat à TagChip statique",
    "bouton de formulaire (type=submit) : TagChip ne rend que type=button",
  ],
  "features/compte/ui/TotpSection.tsx": ["dette: 6B-3 — badge « actif », candidat à TagChip statique"],
  "features/compte/ui/VerrouForm.tsx": ["contrôle de formulaire — pastille portant un champ de saisie"],

  // ── Conciergerie ───────────────────────────────────────────────────────────
  "features/conciergerie/ui/DemandesList.tsx": ["dette: 6B-3 — badge de statut, candidat à TagChip statique"],

  // ── Famille ────────────────────────────────────────────────────────────────
  "features/famille/ui/CercleList.tsx": ["dette: 6B-3 — badge descriptif, candidat à TagChip statique"],
  "features/famille/ui/CompteProcheBlock.tsx": ["dette: 6B-3 — badge « compte rattaché », candidat à TagChip statique"],
  "features/famille/ui/DocumentTunnel.tsx": [
    "dette: 6B-3 — chip interactif (aria-pressed) migrable vers TagChip",
    "dette: 6B-3 — chip interactif (aria-pressed) migrable vers TagChip",
    "dette: 6B-3 — badge d'étape, candidat à TagChip statique",
  ],
  "features/famille/ui/ExpiryBadge.tsx": ["dette: 6B-3 — badge d'expiration, candidat à TagChip statique"],
  "features/famille/ui/FamilleRail.tsx": ["dette: 6B-3 — badge « épinglé », candidat à TagChip statique"],
  "features/famille/ui/FichePersonne.tsx": ["dette: 6B-3 — badge descriptif, candidat à TagChip statique"],
  "features/famille/ui/ProcheForm.tsx": [
    "contrôle de formulaire — <label> enveloppant un radio masqué",
    "contrôle de formulaire — <label> enveloppant un radio masqué",
  ],

  // ── Places (restaurants, hôtels) ───────────────────────────────────────────
  "features/places/ui/CategoryDiscovery.tsx": [
    "constante de classe d'un onglet de découverte, appliquée à des boutons d'action",
    "dette: 6B-3 — badge « déjà ajouté », candidat à TagChip statique",
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
    "bouton de formulaire (type=submit) : TagChip ne rend que type=button",
  ],
  "features/places/ui/CategoryMap.tsx": [
    "bouton flottant superposé à la carte (« Autour de moi »)",
    "dette: 6B-3 — badge de marqueur, candidat à TagChip statique",
  ],
  "features/places/ui/CategoryMapCombined.tsx": [
    "constante de classe d'un bouton flottant de carte",
    "dette: 6B-3 — chip interactif (aria-pressed) migrable vers TagChip",
    "dette: 6B-3 — chip interactif (aria-pressed) migrable vers TagChip",
  ],
  "features/places/ui/CategoryTabs.tsx": [
    "dette: 6B-3 — badge d'origine teinté, candidat à TagChip statique",
    "bouton d'action (« marquer la visite »), rond par commodité",
    "bouton de formulaire (type=submit) : TagChip ne rend que type=button",
  ],
  "features/places/ui/SejourContexteChips.tsx": ["constante de classe de déclencheurs de modale, pas de chips"],
  "features/places/ui/SejoursAVenirBlock.tsx": [
    "lien de navigation vers le voyage, pas un chip",
    "bouton d'action qui ouvre le formulaire de séjour",
  ],

  // ── Réception ──────────────────────────────────────────────────────────────
  "features/reception/ui/ReceptionList.tsx": [
    "bouton d'action (accepter), rond par commodité",
    "bouton d'action (refuser), rond par commodité",
  ],
  "features/reception/ui/RecommanderButton.tsx": [
    "bouton d'action qui ouvre la liste des destinataires",
    "dette: 6B-3 — confirmation « envoyé », candidat à TagChip statique",
  ],

  // ── Restaurants ────────────────────────────────────────────────────────────
  "features/restos/ui/FicheResto.tsx": ["lien de navigation vers le voyage, pas un chip"],
  "features/restos/ui/OrigineForm.tsx": [
    "chip interactif contenant un <Avatar> et compensant par pl-1 ; TagChip n'expose pas de className, volontairement",
  ],
  "features/restos/ui/StatutChip.tsx": ["déclencheur de menu (aria-expanded), pas un chip"],

  // ── Coquille ───────────────────────────────────────────────────────────────
  "features/shell/ui/Introuvable.tsx": ["lien de retour à l'accueil, pas un chip"],

  // ── Vins ───────────────────────────────────────────────────────────────────
  "features/vins/ui/CaveMap.tsx": ["bouton flottant superposé à la carte"],
  "features/vins/ui/CavePanel.tsx": [
    "bouton d'action qui bascule l'affichage de la cave",
    "bouton d'action qui bascule l'affichage de la cave",
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
    "constante de classe d'un champ de saisie rond",
  ],
  "features/vins/ui/CaveStatsPanel.tsx": ["dette: 6B-3 — <li> de cépage, candidat à TagChip statique"],
  "features/vins/ui/CorrectionAnalyse.tsx": [
    "bouton d'action qui corrige un champ analysé",
    "champ de saisie rond (bordure tiretée), pas un chip",
  ],
  "features/vins/ui/EtiquetteTunnel.tsx": ["dette: 6B-3 — badge de confiance, candidat à TagChip statique"],
  "features/vins/ui/MaDegustationForm.tsx": [
    "dette: 6B-3 — chip interactif (aria-pressed) migrable vers TagChip",
    "bouton d'action qui ajoute un arôme",
    "champ de saisie rond, pas un chip",
    "bouton d'action (bordure tiretée) qui ouvre la saisie libre",
    "contrôle de formulaire — pastille portant un champ de saisie",
  ],
  "features/vins/ui/VinFiche.tsx": [
    "dette: 6B-3 — <li> d'arôme, candidat à TagChip statique",
    "dette: 6B-3 — <li> d'arôme, candidat à TagChip statique",
    "dette: 6B-3 — badge de tag, candidat à TagChip statique",
  ],

  // ── Voyages ────────────────────────────────────────────────────────────────
  "features/voyages/ui/DepensesVoyageBlock.tsx": [
    "bouton d'action qui ouvre le détail d'une dépense",
    "bouton d'action (bordure tiretée) qui ajoute une dépense",
  ],
  "features/voyages/ui/DocumentsList.tsx": ["dette: 6B-3 — badge « rattaché », candidat à TagChip statique"],
  "features/voyages/ui/ParticipantsList.tsx": [
    "bouton d'action (bordure tiretée) qui ajoute un voyageur",
    "bouton d'action sur un voyageur",
    "bouton d'action sur un voyageur",
    "dette: 6B-3 — chip interactif (aria-pressed) migrable vers TagChip",
  ],
  "features/voyages/ui/PiecesJointes.tsx": ["lien de téléchargement d'une pièce jointe, pas un chip"],
  "features/voyages/ui/PlanningCalendrier.tsx": [
    "dette: 6B-3 — badge de vacances, candidat à TagChip statique",
    "lien de navigation vers les réglages de zone",
    "lien de navigation vers un voyage",
  ],
  "features/voyages/ui/PlanningFrise.tsx": ["dette: 6B-3 — badge de vacances, candidat à TagChip statique"],
  "features/voyages/ui/ProgrammeBlock.tsx": ["dette: 6B-3 — badge descriptif, candidat à TagChip statique"],
  "features/voyages/ui/VoyageDetail.tsx": [
    "dette: 6B-3 — badge de compte à rebours, candidat à TagChip statique",
    "lien d'action (itinéraire), pas un chip",
    "lien d'action (appeler / site), pas un chip",
    "dette: 6B-3 — badge descriptif, candidat à TagChip statique",
  ],
  "features/voyages/ui/VoyagesList.tsx": [
    "dette: 6B-3 — chip interactif (aria-pressed) migrable vers TagChip",
    "dette: 6B-3 — badge de compte à rebours, candidat à TagChip statique",
    "dette: 6B-3 — badge de statut, candidat à TagChip statique",
  ],
};
