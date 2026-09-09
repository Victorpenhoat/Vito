import { describe, it, expect } from "vitest";
import { placer, repartirColonnes, enHeures, RAIL_DEBUT, RAIL_FIN } from "./grilleSemaine";

describe("enHeures", () => {
  it("convertit une heure en fraction", () => {
    expect(enHeures("17:30")).toBe(17.5);
    expect(enHeures("08:00")).toBe(8);
  });
});

describe("placer", () => {
  it("place un cours au bon endroit du rail", () => {
    // 8h → 20h, soit douze heures. 14h est à la moitié.
    const p = placer("14:00", "15:00")!;
    expect(p.hautPct).toBeCloseTo(50, 1);
    expect(p.hauteurPct).toBeCloseTo(100 / 12, 1);
  });

  it("le haut du rail est à zéro, le bas à cent", () => {
    expect(placer("08:00", "09:00")!.hautPct).toBe(0);
    const soir = placer("19:00", "20:00")!;
    expect(soir.hautPct + soir.hauteurPct).toBeCloseTo(100, 1);
  });

  it("un cours qui déborde est rogné, pas rejeté", () => {
    // 7h → 9h : la première heure est hors rail, la seconde reste visible.
    const tot = placer("07:00", "09:00")!;
    expect(tot.hautPct).toBe(0);
    expect(tot.hauteurPct).toBeCloseTo(100 / 12, 1);
  });

  it("une séance de dix minutes garde une hauteur cliquable", () => {
    expect(placer("14:00", "14:10")!.hauteurPct).toBeGreaterThanOrEqual(3);
  });

  it("ce qui tombe entièrement hors du rail n'est pas placé", () => {
    expect(placer("06:00", "07:00")).toBeNull();
    expect(placer("21:00", "22:00")).toBeNull();
  });

  it("le rail par défaut est celui de la maquette", () => {
    expect([RAIL_DEBUT, RAIL_FIN]).toEqual([8, 20]);
  });
});

describe("repartirColonnes", () => {
  const s = (heureDebut: string, heureFin: string, id = heureDebut) => ({ id, heureDebut, heureFin });

  it("une séance seule occupe toute la largeur", () => {
    const [r] = repartirColonnes([s("10:00", "11:00")]);
    expect(r).toMatchObject({ rang: 0, total: 1 });
  });

  it("deux séances simultanées se partagent la largeur", () => {
    const res = repartirColonnes([s("14:00", "15:00", "a"), s("14:30", "16:00", "b")]);
    expect(res.map((r) => r.rang)).toEqual([0, 1]);
    expect(res.every((r) => r.total === 2)).toBe(true);
  });

  it("des séances qui ne se touchent pas gardent chacune toute la largeur", () => {
    const res = repartirColonnes([s("09:00", "10:00", "matin"), s("14:00", "15:00", "aprem")]);
    expect(res.every((r) => r.total === 1 && r.rang === 0)).toBe(true);
  });

  it("une séance isolée n'est pas rétrécie par un chevauchement ailleurs dans la journée", () => {
    const res = repartirColonnes([
      s("09:00", "10:00", "seule"),
      s("14:00", "15:00", "a"), s("14:00", "15:00", "b"),
    ]);
    expect(res.find((r) => r.seance.id === "seule")!.total).toBe(1);
    expect(res.find((r) => r.seance.id === "a")!.total).toBe(2);
  });

  it("trois séances qui se recouvrent occupent trois colonnes", () => {
    const res = repartirColonnes([
      s("14:00", "16:00", "a"), s("14:30", "15:30", "b"), s("15:00", "17:00", "c"),
    ]);
    expect(new Set(res.map((r) => r.rang)).size).toBe(3);
  });

  it("une journée vide ne rend rien", () => {
    expect(repartirColonnes([])).toEqual([]);
  });
});
