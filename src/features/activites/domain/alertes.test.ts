import { describe, it, expect } from "vitest";
import { construireAlertes, grouperAlertes, nombreAlertesUrgentes, type SourceAlertes } from "./alertes";

const AUJ = "2026-09-07";

const source = (p: Partial<SourceAlertes["activites"][number]>): SourceAlertes => ({
  activites: [{
    id: "a", nom: "Équitation", membres: [{ prenom: "Alexia" }],
    paiements: [], documents: [], ...p,
  }],
});

describe("construireAlertes", () => {
  it("une échéance dépassée est en retard", () => {
    const a = construireAlertes(source({
      paiements: [{ id: "p", montantCents: 31_000, echeance: "2026-09-01", statut: "du" }],
    }), AUJ);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ genre: "paiement", urgence: "en_retard", montantCents: 31_000 });
  });

  it("une échéance dans trois semaines presse ; dans six mois, non", () => {
    const proche = construireAlertes(source({
      paiements: [{ id: "p", montantCents: 1, echeance: "2026-09-28", statut: "du" }],
    }), AUJ);
    expect(proche[0]?.urgence).toBe("proche");

    const loin = construireAlertes(source({
      paiements: [{ id: "p", montantCents: 1, echeance: "2027-03-01", statut: "du" }],
    }), AUJ);
    expect(loin[0]?.urgence).toBe("plus_tard");
  });

  it("un paiement réglé ne demande rien", () => {
    expect(construireAlertes(source({
      paiements: [{ id: "p", montantCents: 1, echeance: "2026-01-01", statut: "paye" }],
    }), AUJ)).toEqual([]);
  });

  it("un certificat expiré alerte, un certificat valide non", () => {
    const expire = construireAlertes(source({
      documents: [{ id: "d", type: "certificat_medical", expireLe: "2026-08-31" }],
    }), AUJ);
    expect(expire[0]).toMatchObject({ genre: "document", urgence: "en_retard" });

    expect(construireAlertes(source({
      documents: [{ id: "d", type: "licence", expireLe: "2027-06-30" }],
    }), AUJ)).toEqual([]);
  });

  it("un document qui expire dans 21 jours le dit", () => {
    const a = construireAlertes(source({
      documents: [{ id: "d", type: "certificat_medical", expireLe: "2026-09-28" }],
    }), AUJ);
    expect(a[0]).toMatchObject({ urgence: "proche", jours: 21 });
  });

  it("un document sans date d'expiration n'alerte jamais", () => {
    // Un règlement intérieur ne périme pas.
    expect(construireAlertes(source({
      documents: [{ id: "d", type: "reglement", expireLe: null }],
    }), AUJ)).toEqual([]);
  });

  it("trie par urgence, puis par date la plus proche", () => {
    const a = construireAlertes(source({
      paiements: [
        { id: "loin", montantCents: 1, echeance: "2027-03-01", statut: "du" },
        { id: "retard", montantCents: 1, echeance: "2026-09-01", statut: "du" },
        { id: "proche2", montantCents: 1, echeance: "2026-09-30", statut: "du" },
        { id: "proche1", montantCents: 1, echeance: "2026-09-20", statut: "du" },
      ],
    }), AUJ);
    expect(a.map((x) => x.cle)).toEqual([
      "paiement:retard", "paiement:proche1", "paiement:proche2", "paiement:loin",
    ]);
  });
});

describe("grouperAlertes", () => {
  it("rend les trois sections dans l'ordre, en omettant les vides", () => {
    const a = construireAlertes(source({
      paiements: [{ id: "p", montantCents: 1, echeance: "2026-09-01", statut: "du" }],
    }), AUJ);
    expect(grouperAlertes(a).map((g) => g.urgence)).toEqual(["en_retard"]);
  });

  it("sans rien à traiter, aucune section", () => {
    expect(grouperAlertes([])).toEqual([]);
  });
});

describe("nombreAlertesUrgentes", () => {
  it("ne compte que ce qui presse : une pastille toujours allumée cesse d'être lue", () => {
    const a = construireAlertes(source({
      paiements: [
        { id: "retard", montantCents: 1, echeance: "2026-09-01", statut: "du" },
        { id: "loin", montantCents: 1, echeance: "2027-03-01", statut: "du" },
      ],
    }), AUJ);
    expect(a).toHaveLength(2);
    expect(nombreAlertesUrgentes(a)).toBe(1);
  });
});
