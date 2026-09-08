import { describe, it, expect } from "vitest";
import { versIcs, premiereOccurrence, type ActiviteIcs } from "./ics";

const AUJ = "2026-09-07"; // lundi
const creneau = { id: "c1", jourSemaine: 6, heureDebut: "10:00", heureFin: "11:00" };
const activite = (p: Partial<ActiviteIcs> = {}): ActiviteIcs => ({
  id: "a", nom: "Équitation", clubNom: "Poney-club", adresse: "12 route du Cap",
  saisonDebut: "2026-09-01", saisonFin: "2027-06-30", creneaux: [creneau], ...p,
});

describe("premiereOccurrence", () => {
  it("tombe sur le premier samedi à partir du début de saison", () => {
    expect(premiereOccurrence(creneau, "2026-09-01")).toBe("2026-09-05");
  });

  it("respecte la date de validité du créneau si elle est plus tardive", () => {
    expect(premiereOccurrence({ ...creneau, valideDu: "2026-10-01" }, "2026-09-01")).toBe("2026-10-03");
  });
});

describe("versIcs", () => {
  const ics = versIcs(activite(), AUJ);

  it("produit un calendrier valide, en CRLF comme la norme l'exige", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("répète chaque semaine le bon jour, jusqu'à la fin de saison", () => {
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20270630T235900");
    expect(ics).toContain("DTSTART:20260905T100000");
    expect(ics).toContain("DTEND:20260905T110000");
  });

  it("les heures sont FLOTTANTES : ni « Z » ni fuseau sur DTSTART", () => {
    // Ancrées en UTC, elles glisseraient d'une heure au changement d'heure.
    expect(ics).not.toContain("DTSTART:20260905T100000Z");
  });

  it("sans fin de saison, la répétition n'a pas de borne", () => {
    const sansFin = versIcs(activite({ saisonFin: null }), AUJ);
    expect(sansFin).toContain("RRULE:FREQ=WEEKLY;BYDAY=SA");
    expect(sansFin).not.toContain("UNTIL=");
  });

  it("un identifiant stable : réimporter met à jour au lieu de dupliquer", () => {
    expect(ics).toContain("UID:c1@vito");
  });

  it("échappe les virgules, que la norme utilise comme séparateurs", () => {
    const virgules = versIcs(activite({ nom: "Danse, classique" }), AUJ);
    expect(virgules).toContain("SUMMARY:Danse\\, classique");
  });

  it("un créneau par événement", () => {
    const deux = versIcs(activite({
      creneaux: [creneau, { id: "c2", jourSemaine: 3, heureDebut: "14:00", heureFin: "15:00" }],
    }), AUJ);
    expect(deux.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(deux).toContain("BYDAY=WE");
  });

  it("une activité sans créneau produit un calendrier vide, pas une erreur", () => {
    const vide = versIcs(activite({ creneaux: [] }), AUJ);
    expect(vide).not.toContain("BEGIN:VEVENT");
    expect(vide).toContain("END:VCALENDAR");
  });
});
