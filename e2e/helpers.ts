import { expect, type Page, type Locator } from "@playwright/test";

// Assertion post-server-action robuste à la race RSC (slot non commité) : tente la visibilité,
// et sur échec SEULEMENT recharge la page (rendu frais depuis la base → re-commit du slot) puis
// ré-assert. Un élément réellement absent échoue quand même après le reload → les vrais bugs ne
// sont pas masqués. À réserver aux assertions sur état PERSISTANT (pas toast/focus/UI éphémère).
export async function expectVisibleWithReload(
  page: Page,
  locator: Locator,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 10_000;
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch {
    await page.reload();
    await expect(locator).toBeVisible({ timeout });
  }
}

// Variante texte (soldes, statuts persistants) : même stratégie sur toContainText.
export async function expectTextWithReload(
  page: Page,
  locator: Locator,
  text: string | RegExp,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 10_000;
  try {
    await expect(locator).toContainText(text, { timeout });
  } catch {
    await page.reload();
    await expect(locator).toContainText(text, { timeout });
  }
}

// Variante compte (disparition après suppression, apparition d'un nouveau membre…) : même
// stratégie sur toHaveCount. Utile quand l'assertion porte sur le NOMBRE d'items persistants
// (un toHaveCount(0) qui ne se réalise jamais si le slot supprimé n'est pas re-commité, ou un
// toHaveCount(n) qui reste bloqué sous l'ancien état). Un vrai écart de compte échoue quand
// même après le reload → les bugs ne sont pas masqués.
export async function expectCountWithReload(
  page: Page,
  locator: Locator,
  count: number,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 10_000;
  try {
    await expect(locator).toHaveCount(count, { timeout });
  } catch {
    await page.reload();
    await expect(locator).toHaveCount(count, { timeout });
  }
}
