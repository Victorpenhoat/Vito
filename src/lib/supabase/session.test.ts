// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./session";

// Simule le SDK : getUser() déclenche (ou non) une réécriture des cookies de
// session via l'adaptateur cookies fourni — c'est ce qui se passe quand le
// JWT expiré est rafraîchi dans le proxy.
let refreshedCookies: { name: string; value: string; options: { path: string } }[];

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { getAll: () => unknown; setAll: (c: typeof refreshedCookies) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        if (refreshedCookies.length > 0) opts.cookies.setAll(refreshedCookies);
        return { data: { user: { id: "u1" } }, error: null };
      },
    },
  }),
}));

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" },
}));

function makeRequest() {
  return new NextRequest("http://localhost:3000/fr/restos", {
    headers: { cookie: "sb-vito-auth-token=stale" },
  });
}

describe("updateSession", () => {
  beforeEach(() => {
    refreshedCookies = [];
  });

  it("écrit les cookies rafraîchis sur la requête — le rendu aval doit voir le JWT frais", async () => {
    refreshedCookies = [{ name: "sb-vito-auth-token", value: "fresh", options: { path: "/" } }];
    const request = makeRequest();
    await updateSession(request);
    expect(request.cookies.get("sb-vito-auth-token")?.value).toBe("fresh");
  });

  it("retourne les cookies rafraîchis pour propagation sur la réponse (Set-Cookie navigateur)", async () => {
    refreshedCookies = [{ name: "sb-vito-auth-token", value: "fresh", options: { path: "/" } }];
    const request = makeRequest();
    const result = await updateSession(request);
    expect(result).toEqual([{ name: "sb-vito-auth-token", value: "fresh", options: { path: "/" } }]);
  });

  it("sans refresh : la requête est intacte et rien à propager", async () => {
    const request = makeRequest();
    const result = await updateSession(request);
    expect(request.cookies.get("sb-vito-auth-token")?.value).toBe("stale");
    expect(result).toEqual([]);
  });
});
