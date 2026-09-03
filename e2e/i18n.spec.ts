import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("un écran module s'affiche en anglais via /en", async ({ page }) => {
  await login(page);
  await page.goto("/en/restos");
  // le titre de page restos en anglais (valeur EN de restos.title — à aligner avec la traduction)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/My restaurants|Restaurants/);
});
