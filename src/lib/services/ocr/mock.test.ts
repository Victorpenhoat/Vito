import { describe, it, expect } from "vitest";
import { MockOcrProvider } from "./mock";

describe("MockOcrProvider", () => {
  it("renvoie des champs déterministes pour un passeport", async () => {
    const r = await new MockOcrProvider().read(Buffer.from("x"), "application/pdf", "passeport");
    expect(r.fields.doc_number).toBeTruthy();
    expect(r.fields.country).toBe("France");
    expect(r.fields.expiry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.raw).toEqual({ mock: true, docType: "passeport" });
  });

  it("renvoie le docType dans raw", async () => {
    const r = await new MockOcrProvider().read(Buffer.from("x"), "image/png", "visa");
    expect(r.raw).toEqual({ mock: true, docType: "visa" });
  });
});
