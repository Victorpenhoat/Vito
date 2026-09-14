import { describe, it, expect } from "vitest";
import { migrationsManquantes, messageEcart } from "./migrations-ecart.mjs";

// La sortie de `supabase migration list --linked -o json`.
const liste = (paires) => paires.map(([local, remote]) => ({ local, remote, time: local || remote }));

describe("migrationsManquantes", () => {
  it("ne signale rien quand la prod a tout", () => {
    expect(migrationsManquantes(liste([["00067", "00067"], ["00068", "00068"]]))).toEqual([]);
  });

  it("nomme celles que main a et que la prod n'a pas, dans l'ordre", () => {
    expect(migrationsManquantes(liste([["00068", "00068"], ["00069", ""], ["00070", ""]])))
      .toEqual(["00069", "00070"]);
  });

  it("ignore ce que la prod a EN PLUS", () => {
    // Cas réel : 00061 et 00062 appartiennent à une branche non fusionnée, et
    // d'anciennes migrations peuvent avoir été appliquées puis retirées du
    // dépôt. Ce n'est pas un retard de déploiement — crier dessus rendrait le
    // garde-fou bruyant, donc ignoré.
    expect(migrationsManquantes(liste([["", "00061"], ["00068", "00068"]]))).toEqual([]);
  });

  it("traite une entrée sans distant comme manquante, pas comme inconnue", () => {
    expect(migrationsManquantes([{ local: "00069", remote: null }])).toEqual(["00069"]);
  });
});

describe("messageEcart", () => {
  it("dit combien, lesquelles, et quoi faire", () => {
    const m = messageEcart(["00069", "00070"]);
    expect(m).toContain("2");
    expect(m).toContain("00069");
    expect(m).toContain("00070");
    expect(m).toMatch(/db push/);
  });

  it("félicite sobrement quand il n'y a rien à dire", () => {
    expect(messageEcart([])).toMatch(/à jour/i);
  });
});
