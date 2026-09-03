import type { LabelResult, VinLabelProvider } from "./types";

// Fixture déterministe : fait tourner tous les tests et e2e sans clé API ni coût
// (même principe que MockOcrProvider). Une image d'un seul octet simule la photo
// illisible, pour couvrir l'état « Lumière faible — réessayer ou saisir ».
export class MockVinLabelProvider implements VinLabelProvider {
  async read(bytes: Buffer | null, _mimeType: string | null, hint?: string): Promise<LabelResult> {
    if (bytes && bytes.length <= 1) {
      return {
        fields: { domaine: null, cuvee: null, appellation: null, millesime: null, couleur: null, cepages: [], degre: null, region: null },
        confiance: {},
        analyse: null,
        illisible: true,
        modele: "mock",
        raw: { mock: true, illisible: true },
      };
    }
    return {
      fields: {
        domaine: "Domaine Tempier",
        cuvee: hint?.trim() ? hint.trim() : "Bandol",
        appellation: "Bandol",
        millesime: 2021,
        couleur: "rouge",
        cepages: ["Mourvèdre", "Grenache"],
        degre: 14.5,
        region: "Provence",
      },
      confiance: {
        domaine: "sur",
        appellation: "sur",
        couleur: "sur",
        millesime: "a_verifier",
        cepages: "probable",
        degre: "probable",
      },
      analyse: {
        profil: { corps: 4, tanins: 4, acidite: 3, sucre: 0 },
        aromes: ["Fruits noirs", "Garrigue", "Poivre", "Cuir"],
        accords: ["Gigot d'agneau", "Daube provençale", "Fromages affinés"],
        service: { temperature: "16–18 °C", carafage: "1 h", garde: "10 ans et plus" },
        prixEstime: 28,
        presentation:
          "Référence historique de Bandol, le domaine cultive le mourvèdre en restanques au-dessus de la baie. " +
          "L'appellation produit des rouges de garde puissants et épicés, parmi les plus réputés de Provence.",
      },
      illisible: false,
      modele: "mock",
      raw: { mock: true, hint: hint ?? null },
    };
  }
}
