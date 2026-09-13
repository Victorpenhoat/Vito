import { describe, it, expect } from "vitest";
import { decalagePour, configPatchee, envPatche, DECALAGES_MAX } from "./worktree-ports.mjs";

describe("decalagePour", () => {
  it("donne le même décalage au même worktree", () => {
    expect(decalagePour("filet-rls")).toBe(decalagePour("filet-rls"));
  });

  it("décale d'une centaine entière, jamais de zéro", () => {
    // Zéro rendrait la pile du worktree indiscernable de la principale — c'est
    // exactement la collision que ce lot existe pour supprimer.
    for (const nom of ["a", "filet-rls", "lot6b2-interactives", "masque-presence"]) {
      const d = decalagePour(nom);
      expect(d % 100).toBe(0);
      expect(d).toBeGreaterThanOrEqual(100);
      expect(d).toBeLessThanOrEqual(100 * DECALAGES_MAX);
    }
  });

  it("cède la place à un décalage déjà occupé", () => {
    const pris = decalagePour("filet-rls");
    expect(decalagePour("filet-rls", [pris])).not.toBe(pris);
  });

  it("refuse plutôt que de rendre un port déjà pris quand tout est occupé", () => {
    const tous = Array.from({ length: DECALAGES_MAX }, (_, i) => 100 * (i + 1));
    expect(() => decalagePour("filet-rls", tous)).toThrow(/aucun/i);
  });
});

describe("configPatchee", () => {
  const CONFIG = [
    'project_id = "Vito"',
    "port = 54321",
    "port = 54322",
    "shadow_port = 54320",
    "# smtp_port = 54325",
    "port = 54327",
    "taille = 12345",
  ].join("\n");

  it("renomme le projet, sans quoi les conteneurs se marchent dessus", () => {
    expect(configPatchee(CONFIG, { projectId: "Vito-filet-rls", decalage: 100 }))
      .toContain('project_id = "Vito-filet-rls"');
  });

  it("décale TOUS les ports, y compris celui qu'on oublie", () => {
    // 54327 (analytique du stockage) est le sixième port : mesuré au spike,
    // l'oublier fait échouer le démarrage de la seconde pile.
    const patchee = configPatchee(CONFIG, { projectId: "x", decalage: 100 });
    expect(patchee).toContain("port = 54421");
    expect(patchee).toContain("port = 54422");
    expect(patchee).toContain("shadow_port = 54420");
    expect(patchee).toContain("# smtp_port = 54425");
    expect(patchee).toContain("port = 54427");
    expect(patchee).not.toMatch(/\b543\d\d\b/);
  });

  it("ne touche pas aux nombres qui ne sont pas des ports", () => {
    expect(configPatchee(CONFIG, { projectId: "x", decalage: 100 })).toContain("taille = 12345");
  });
});

describe("envPatche", () => {
  const ENV = [
    "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=abc",
    "MAIL_MAILPIT_URL=http://127.0.0.1:54324",
  ].join("\n");

  it("pointe l'app et Mailpit sur les ports de la pile du worktree", () => {
    const r = envPatche(ENV, { decalage: 200 });
    expect(r).toContain("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521");
    expect(r).toContain("MAIL_MAILPIT_URL=http://127.0.0.1:54524");
  });

  it("isole aussi le serveur de test, sinon deux worktrees se disputent le 3001", () => {
    expect(envPatche(ENV, { decalage: 200 })).toContain("E2E_PORT=3003");
  });

  it("laisse les clés intactes : elles dérivent du même secret JWT", () => {
    expect(envPatche(ENV, { decalage: 200 })).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=abc");
  });

  it("rejoué, il ne dérive pas : le second passage rend le même fichier", () => {
    // Défaut mesuré le 2026-09-13 : le premier jet ne savait patcher qu'un
    // fichier NEUF, et rejouer le script laissait l'URL sur l'ancienne pile —
    // silencieusement, puisque l'ancienne pile répondait encore.
    const une = envPatche(ENV, { decalage: 200 });
    expect(envPatche(une, { decalage: 200 })).toBe(une);
  });

  it("suit un changement de décalage sans repartir du fichier d'origine", () => {
    const une = envPatche(ENV, { decalage: 200 });
    expect(envPatche(une, { decalage: 300 })).toContain("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54621");
  });
});
