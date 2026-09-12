import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, tableInsert, type OpResult } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
let mock: ReturnType<typeof createMockSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => mock.client }));

import { creerCodeLien, lireLien, lierAvecCode } from "./lienActions";
import { ALPHABET_CODE } from "../domain/lienCompte";

const fd = (e: Array<[string, string]>) => { const f = new FormData(); e.forEach(([k, v]) => f.append(k, v)); return f; };
beforeEach(() => revalidatePath.mockClear());

describe("creerCodeLien", () => {
  it("refuse sans authentification", async () => {
    mock = createMockSupabase({ user: null });
    expect(await creerCodeLien(undefined, fd([["relation", "conjoint"]]))).toEqual({ error: "Non authentifié" });
  });

  it("refuse « moi » : cette fiche ne décrit personne d'autre", async () => {
    mock = createMockSupabase();
    expect(await creerCodeLien(undefined, fd([["relation", "moi"]]))).toEqual({ error: "Relation invalide" });
    expect(mock.calls).toHaveLength(0);
  });

  it("émet un code de huit caractères, valable un quart d'heure", async () => {
    mock = createMockSupabase({ on: () => ({ data: { id: "inv1" } }) });
    const res = await creerCodeLien(undefined, fd([["relation", "conjoint"]]));
    expect("code" in res && res.code).toMatch(/^[2-9A-HJKMNP-TV-Z]{8}$/);
    const payload = tableInsert(mock.calls, "invitations")?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ role_vise: "cercle", relation: "conjoint", cree_par: "u1", family_member_id: null });
    for (const c of String(payload.code)) expect(ALPHABET_CODE).toContain(c);
    const dans = (new Date(String(payload.expire_le)).getTime() - Date.now()) / 60000;
    expect(dans).toBeGreaterThan(14);
    expect(dans).toBeLessThan(16);
  });

  it("rejoue avec un autre code si celui-ci est déjà pris", async () => {
    let essais = 0;
    mock = createMockSupabase({
      on: (t, ctx) => (t === "invitations" && ctx.op === "insert"
        ? (++essais === 1 ? { error: { code: "23505" } } : { data: { id: "inv2" } })
        : { data: null }),
    });
    const res = await creerCodeLien(undefined, fd([["relation", "ami"]]));
    expect("code" in res).toBe(true);
    expect(essais).toBe(2);
  });

  it("vise une fiche existante après l'avoir relue sous RLS", async () => {
    mock = createMockSupabase({
      on: (t, ctx) => (t === "family_members"
        ? { data: { id: "fm1", profile_id: null } }
        : ctx.op === "insert" ? { data: { id: "inv3" } } : { data: null }),
    });
    const res = await creerCodeLien(undefined, fd([["relation", "conjoint"], ["familyMemberId", "fm1"]]));
    expect("code" in res).toBe(true);
    expect((tableInsert(mock.calls, "invitations")?.payload as Record<string, unknown>).family_member_id).toBe("fm1");
  });

  it("refuse une fiche qui n'est pas la mienne", async () => {
    mock = createMockSupabase({ on: (t) => (t === "family_members" ? { data: null } : { data: { id: "x" } }) });
    expect(await creerCodeLien(undefined, fd([["relation", "conjoint"], ["familyMemberId", "fm9"]])))
      .toEqual({ error: "Proche introuvable" });
  });

  it("refuse une fiche déjà rattachée à un compte", async () => {
    mock = createMockSupabase({ on: (t) => (t === "family_members" ? { data: { id: "fm1", profile_id: "u2" } } : { data: { id: "x" } }) });
    expect(await creerCodeLien(undefined, fd([["relation", "conjoint"], ["familyMemberId", "fm1"]])))
      .toEqual({ error: "Ce proche a déjà un compte" });
  });
});

describe("lireLien", () => {
  it("normalise la saisie avant d'interroger la base", async () => {
    mock = createMockSupabase({ rpc: () => ({ data: { valide: true, invite_par: "Victor", relation_proposee: "conjoint" } }) });
    const res = await lireLien(" 7k4p-2m9x ");
    expect(res).toMatchObject({ valide: true, invite_par: "Victor" });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "lien_infos", args: { p_code: "7K4P2M9X" } });
  });

  it("un code mal formé n'atteint jamais la base", async () => {
    mock = createMockSupabase({ rpc: () => ({ data: { valide: true } }) });
    expect(await lireLien("pas-un-code")).toEqual({ valide: false });
    expect(mock.calls).toHaveLength(0);
  });
});

describe("lierAvecCode", () => {
  const bon: OpResult = { data: { ok: true, fiche_id: "fm1" } };

  it("lie, puis rafraîchit le Cercle", async () => {
    mock = createMockSupabase({ rpc: () => bon });
    expect(await lierAvecCode(undefined, fd([["code", "7K4P-2M9X"], ["relation", "conjoint"]]))).toEqual({ ok: true });
    expect(mock.calls.find((c) => c.kind === "rpc")).toMatchObject({
      name: "lier_comptes", args: { p_code: "7K4P2M9X", p_relation: "conjoint" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/famille", "layout");
  });

  it("traduit chaque refus de la base, sans rafraîchir", async () => {
    for (const [motif, message] of [
      ["invalide", "Ce code n'est plus valable"],
      ["soi_meme", "Ce code est le vôtre"],
      ["trop_de_tentatives", "Trop d'essais : réessayez dans dix minutes"],
      ["relation_invalide", "Relation invalide"],
    ] as const) {
      mock = createMockSupabase({ rpc: () => ({ data: { ok: false, motif } }) });
      expect(await lierAvecCode(undefined, fd([["code", "7K4P2M9X"], ["relation", "conjoint"]]))).toEqual({ error: message });
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un code mal formé n'atteint jamais la base", async () => {
    mock = createMockSupabase({ rpc: () => bon });
    expect(await lierAvecCode(undefined, fd([["code", "ZZZ"], ["relation", "conjoint"]]))).toEqual({ error: "Code invalide" });
    expect(mock.calls).toHaveLength(0);
  });

  it("refuse sans authentification", async () => {
    mock = createMockSupabase({ user: null, rpc: () => bon });
    expect(await lierAvecCode(undefined, fd([["code", "7K4P2M9X"], ["relation", "conjoint"]]))).toEqual({ error: "Non authentifié" });
  });
});
