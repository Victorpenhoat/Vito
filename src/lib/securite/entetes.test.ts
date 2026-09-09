import { describe, it, expect } from "vitest";
import { construireCsp, origine, ENTETES_STATIQUES } from "./entetes";

const base = { nonce: "abc123", dev: false, supabase: "https://x.supabase.co", sentry: null };

describe("origine", () => {
  it("réduit une URL à son origine", () => {
    expect(origine("https://x.supabase.co/rest/v1?a=1")).toBe("https://x.supabase.co");
  });

  it("rend null sur une URL absente ou illisible plutôt que de jeter", () => {
    expect(origine(undefined)).toBeNull();
    expect(origine("pas une url")).toBeNull();
  });
});

describe("construireCsp", () => {
  it("porte la nonce sur les scripts et les styles", () => {
    const csp = construireCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
  });

  it("ne cède 'unsafe-eval' qu'en développement", () => {
    expect(construireCsp({ ...base, dev: true })).toContain("'unsafe-eval'");
    expect(construireCsp(base)).not.toContain("'unsafe-eval'");
  });

  it("n'autorise l'inline que sur les attributs de style, jamais sur les scripts", () => {
    const csp = construireCsp(base);
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).not.toContain("script-src-attr");
    // La garantie qui compte : aucune directive de script ne tolère l'inline.
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("ouvre connect-src à Supabase, et à Sentry seulement s'il est configuré", () => {
    expect(construireCsp(base)).toContain("connect-src 'self' https://x.supabase.co");
    expect(construireCsp({ ...base, sentry: "https://o1.ingest.sentry.io" }))
      .toContain("connect-src 'self' https://x.supabase.co https://o1.ingest.sentry.io");
  });

  it("laisse passer les tuiles OpenStreetMap, et rien d'autre en image externe", () => {
    const imgSrc = construireCsp(base).split("; ").find((d) => d.startsWith("img-src"));
    expect(imgSrc).toBe("img-src 'self' data: blob: https://*.tile.openstreetmap.org");
  });

  it("verrouille l'encadrement, la base et les objets", () => {
    const csp = construireCsp(base);
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(csp).toContain(d);
    }
  });

  it("ne force https qu'en production", () => {
    expect(construireCsp(base)).toContain("upgrade-insecure-requests");
    expect(construireCsp({ ...base, dev: true })).not.toContain("upgrade-insecure-requests");
  });

  it("désigne le collecteur de violations", () => {
    expect(construireCsp(base)).toContain("report-uri /api/csp-report");
  });
});

describe("ENTETES_STATIQUES", () => {
  it("couvre les en-têtes que la prod ne renvoyait pas", () => {
    const clefs = ENTETES_STATIQUES.map((e) => e.key);
    expect(clefs).toEqual(expect.arrayContaining([
      "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options",
      "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy", "Permissions-Policy",
    ]));
  });

  it("garde géolocalisation et caméra pour nous seuls, et refuse le reste", () => {
    const pp = ENTETES_STATIQUES.find((e) => e.key === "Permissions-Policy")?.value ?? "";
    expect(pp).toContain("geolocation=(self)");
    expect(pp).toContain("camera=(self)");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("payment=()");
  });
});
