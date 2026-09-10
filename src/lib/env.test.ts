import { describe, it, expect } from "vitest";
// Le VRAI schéma, pas une copie : une copie testerait une forme voisine et
// laisserait passer la divergence le jour où l'original change.
import { schema } from "./env";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://x.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
};

/** Une production complète : la garde ne doit mordre que sur ce qui manque. */
const productionComplete = {
  ...base,
  VERCEL_ENV: "production",
  RESEND_API_KEY: "re_x",
  RESEND_WEBHOOK_SECRET: "whsec_x",
  MAIL_EXPEDITEUR: "contact@vito.app",
  NEXT_PUBLIC_APP_URL: "https://vito.app",
};

describe("env refine Stripe", () => {
  it("mock-first : sans clé Stripe, valide", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });
  it("clé Stripe sans compléments → invalide", () => {
    expect(schema.safeParse({ ...base, STRIPE_SECRET_KEY: "sk" }).success).toBe(false);
  });
  it("clé Stripe avec tous les compléments → valide", () => {
    const r = schema.safeParse({
      ...base, STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh",
      STRIPE_PRICE_MONTHLY: "pm", STRIPE_PRICE_YEARLY: "py",
      NEXT_PUBLIC_APP_URL: "https://a.co", SUPABASE_SERVICE_ROLE_KEY: "srv",
    });
    expect(r.success).toBe(true);
  });
});

describe("env refine Resend", () => {
  it("clé Resend sans secret de webhook ni expéditeur → invalide", () => {
    expect(schema.safeParse({ ...base, RESEND_API_KEY: "re_x" }).success).toBe(false);
  });
});

// La garde qui manquait (revue C1) : hors production tout reste optionnel, mais
// une production sans voie d'envoi ne doit PAS démarrer. Sans elle, chaque
// demande de lien magique répond « regardez votre boîte » et rien ne part.
describe("garde de production (e-mails)", () => {
  it("production complète → valide", () => {
    expect(schema.safeParse(productionComplete).success).toBe(true);
  });

  for (const manquante of [
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "MAIL_EXPEDITEUR",
    "NEXT_PUBLIC_APP_URL",
  ] as const) {
    it(`production sans ${manquante} → REFUSÉE, avec un message qui la nomme`, () => {
      const r = schema.safeParse({ ...productionComplete, [manquante]: undefined });
      expect(r.success).toBe(false);
      if (r.success) return;
      expect(r.error.issues.map((i) => i.message).join(" ")).toContain(manquante);
    });
  }

  it("hors production (local, CI, e2e), les mêmes absences restent valides", () => {
    // VERCEL_ENV absent : le développement et la CI, où aucun message ne sort.
    expect(schema.safeParse(base).success).toBe(true);
    // Une préversion n'est pas la production : elle se configure, elle ne bloque pas.
    expect(schema.safeParse({ ...base, VERCEL_ENV: "preview" }).success).toBe(true);
  });
});

// I6 : la CI dérive MAIL_MAILPIT_URL d'une clé de statut Supabase dépréciée.
// Le jour où elle disparaît, le grep rend une chaîne vide — qui ne doit surtout
// pas faire échouer l'import de env.ts, donc TOUS les jobs, avec un message qui
// ne parle même pas d'e-mails.
describe("MAIL_MAILPIT_URL", () => {
  it("vide = absente (et non 'URL invalide')", () => {
    const r = schema.safeParse({ ...base, MAIL_MAILPIT_URL: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.MAIL_MAILPIT_URL).toBeUndefined();
  });

  it("renseignée, elle doit rester une URL", () => {
    expect(schema.safeParse({ ...base, MAIL_MAILPIT_URL: "pas-une-url" }).success).toBe(false);
    const r = schema.safeParse({ ...base, MAIL_MAILPIT_URL: "http://127.0.0.1:54324" });
    expect(r.success && r.data.MAIL_MAILPIT_URL).toBe("http://127.0.0.1:54324");
  });
});
