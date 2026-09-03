// Lecture d'étiquette de vin + analyse (design Vins & Cave, écrans 2 et 4).
// ⚠ Tout ce qui sort d'ici est GÉNÉRÉ par un modèle : chaque champ porte un
// niveau de confiance, l'UI l'affiche et permet de corriger. Rien n'est présenté
// comme certain (contrainte du brief).

/** Niveau de confiance affiché à côté de chaque champ reconnu. */
export const CONFIANCES = ["sur", "probable", "a_verifier"] as const;
export type Confiance = (typeof CONFIANCES)[number];

export const VIN_COULEURS_LABEL = ["rouge", "blanc", "rose", "petillant", "autre"] as const;

/** Champs lus sur l'étiquette. null = illisible ou absent (jamais inventé). */
export type LabelFields = {
  domaine: string | null;
  cuvee: string | null;
  appellation: string | null;
  millesime: number | null;
  couleur: (typeof VIN_COULEURS_LABEL)[number] | null;
  cepages: string[];
  degre: number | null;
  region: string | null;
};

/** Confiance par champ (mêmes clés que LabelFields). */
export type LabelConfiance = Partial<Record<keyof LabelFields, Confiance>>;

/** Analyse générée : profil, arômes, accords, service, garde, prix, présentation. */
export type LabelAnalyse = {
  /** Jauges 0..5 (design : 4 jauges). */
  profil: { corps: number | null; tanins: number | null; acidite: number | null; sucre: number | null };
  aromes: string[];
  accords: string[];
  service: { temperature: string | null; carafage: string | null; garde: string | null };
  /** Prix caviste estimé, en euros. */
  prixEstime: number | null;
  presentation: string | null;
};

export type LabelResult = {
  fields: LabelFields;
  confiance: LabelConfiance;
  analyse: LabelAnalyse | null;
  /** Le modèle n'a rien pu lire (photo trop sombre, étiquette masquée…). */
  illisible: boolean;
  modele: string;
  raw: unknown;
};

export const EMPTY_LABEL_FIELDS: LabelFields = {
  domaine: null,
  cuvee: null,
  appellation: null,
  millesime: null,
  couleur: null,
  cepages: [],
  degre: null,
  region: null,
};

export interface VinLabelProvider {
  /** Lit une photo d'étiquette. `hint` = saisie libre pour la recherche sans photo. */
  read(bytes: Buffer | null, mimeType: string | null, hint?: string): Promise<LabelResult>;
}
