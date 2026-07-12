import { test, expect } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

// Vérifie le CONTRAT du helper sur une page réelle (login, sans auth), pas la race.
test("expectVisibleWithReload : élément présent → passe sans lever", async ({ page }) => {
  await page.goto("/fr/login");
  await expectVisibleWithReload(page, page.getByLabel("E-mail"));
});

test("expectVisibleWithReload : élément absent → lève (ne réussit pas à tort)", async ({ page }) => {
  await page.goto("/fr/login");
  // timeout court : la double tentative (1ʳᵉ + reload) reste ~1 s au lieu de 2×10 s.
  await expect(
    expectVisibleWithReload(page, page.getByTestId("nexiste-pas-xyz"), { timeout: 500 }),
  ).rejects.toThrow();
});
