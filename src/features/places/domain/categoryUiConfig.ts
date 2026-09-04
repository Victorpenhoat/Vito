// Brique générique Restos/Hôtels (brief Hôtels v2) : les composants v2
// (CategoryTabs, CategoryDiscovery, CategoryMap*, ExperienceForm) sont
// paramétrés par catégorie via cet objet — les pages ne passent que la clé
// `categorie` (sérialisable RSC→client), le composant client résout la config.
// Les valeurs resto reproduisent À L'OCTET l'ancien fork restos/ui (testids,
// clés i18n, storageKey) : e2e places/restos/restos-tags inchangés.

export type CategorieUi = "resto" | "hotel";

export type CategoryUiConfig = {
  categorie: CategorieUi;
  /** Base des liens fiches et de la page tags. */
  basePath: "/restos" | "/hotels";
  /** Namespace i18n des libellés spécifiques (le namespace `places` reste partagé). */
  ns: "restos" | "hotels";
  rootTestId: string;
  /** id ARIA du tabpanel (le data-testid reste `places-panel`, partagé). */
  panelId: string;
  /** Slug du 3ᵉ sous-onglet (statut dérivé « teste ») : resto « testes », hôtel « sejours ».
   *  Pilote le ?onglet=, le testid `tab-<slug>` et les clés i18n `onglets.<slug>` / `vide.<slug>*`. */
  slugTeste: string;
  trouverTestId: string;
  searchTestId: string;
  /** Portée des tags créés à la volée (tags.scope). ⚠ vocabulaire scope ≠ categorie. */
  tagScope: "restaurant" | "hotel";
  storageKey: string;
  /** Chips de type pour la recherche externe (valeurs `includedType` Google). */
  typeChips: readonly string[];
  /** Préfixe i18n des libellés de typeChips (`<ns>.<typeChipsNs>.<chip>`). */
  typeChipsNs: string;
  /** Clés i18n du menu de type : libellé fermé + « tous ». */
  typeFiltreKeys: { label: string; tous: string };
  map: { clusters: boolean; typeFilter: boolean };
  /** Recherche : dates + occupation du séjour et prix/nuit dans les résultats
   *  (hébergements seulement — un restaurant ne se réserve pas par nuitée). */
  contexteSejour: boolean;
  /** Formulaire « j'y suis allé » : visite datée simple (resto) ou séjour arrivée→départ (hôtel). */
  experience: "visite" | "sejour";
};

export const CATEGORY_UI: Record<CategorieUi, CategoryUiConfig> = {
  resto: {
    categorie: "resto",
    basePath: "/restos",
    ns: "restos",
    rootTestId: "restos-tabs",
    panelId: "restos-panel",
    slugTeste: "testes",
    trouverTestId: "trouver-restaurant",
    searchTestId: "add-resto-search",
    tagScope: "restaurant",
    storageKey: "vito.recents.resto",
    typeChips: ["italian_restaurant", "japanese_restaurant", "french_restaurant", "pizza_restaurant"],
    typeChipsNs: "recherche.cuisines",
    typeFiltreKeys: { label: "recherche.cuisine", tous: "recherche.toutesCuisines" },
    map: { clusters: false, typeFilter: false },
    contexteSejour: false,
    experience: "visite",
  },
  hotel: {
    categorie: "hotel",
    basePath: "/hotels",
    ns: "hotels",
    rootTestId: "hotels-tabs",
    panelId: "hotels-panel",
    slugTeste: "sejours",
    trouverTestId: "trouver-hotel",
    searchTestId: "add-hotel-search",
    tagScope: "hotel",
    storageKey: "vito.recents.hotel",
    typeChips: ["hotel", "bed_and_breakfast", "guest_house", "resort_hotel"],
    typeChipsNs: "recherche.types",
    typeFiltreKeys: { label: "recherche.type", tous: "recherche.tousTypes" },
    map: { clusters: true, typeFilter: true },
    contexteSejour: true,
    experience: "sejour",
  },
};

/** testid d'un sous-onglet : `tab-a-tester`, `tab-testes`, `tab-sejours`… */
export function tabTestId(slug: string): string {
  return `tab-${slug.replaceAll("_", "-")}`;
}
