export type VinCouleur = "rouge" | "blanc" | "rose" | "petillant" | "autre";

export type VinEnrichmentInput = {
  nom: string;
  domaine: string | null;
  millesime: number | null;
  region: string | null;
  couleur: VinCouleur | null;
  cepages: string[];
};

export interface EnrichmentProvider {
  readonly name: string;
  normalize(input: VinEnrichmentInput): Promise<VinEnrichmentInput>;
}
