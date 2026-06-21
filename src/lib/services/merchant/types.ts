export type VinAchat = {
  nom: string;
  domaine: string | null;
  millesime: number | null;
  couleur: string | null;
};

export interface MerchantProvider {
  readonly name: string;
  buyUrl(vin: VinAchat, quantity: number): string | null;
}
