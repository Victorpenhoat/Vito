import { describe, it, expect } from "vitest";
import { avatarColor, AVATAR_PALETTE } from "./avatarColor";
describe("avatarColor", () => {
  it("déterministe pour un même seed", () => expect(avatarColor("abc")).toBe(avatarColor("abc")));
  it("renvoie une couleur de la palette", () => expect(AVATAR_PALETTE).toContain(avatarColor("xyz")));
});
