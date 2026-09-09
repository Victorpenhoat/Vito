import { test, expect } from "@playwright/test";
import { login } from "./helpers";
import { BAREMES } from "../src/lib/securite/quota";

// Audit du 9 septembre : « rate limiting — zéro occurrence ». Ces tests
// prouvent que la limite existe VRAIMENT au bout de la chaîne (HTTP, pas
// seulement en base), et qu'elle sépare bien les comptes.
//
// Le compte de la rafale est client7b, qui ne sert qu'à l'agence : saturer le
// compte principal ferait tomber les specs de vins et de famille qui lisent
// une étiquette ou une pièce dans la même minute.
const RAFALE = "client7b@vito.test";
const LIMITE = BAREMES.lecture_etiquette.limite;

function etiquette() {
  return {
    hint: "un rouge de Loire",
  };
}

test("une rafale finit par recevoir 429, et pas avant la limite", async ({ page }) => {
  await login(page, RAFALE);

  // Les appels sous la limite passent tous : une limite qui mord trop tôt
  // casserait l'usage normal, ce serait un autre bug.
  for (let i = 1; i <= LIMITE; i++) {
    const r = await page.request.post("/api/vins/etiquette/read", { multipart: etiquette() });
    expect(r.status(), `appel ${i} sur ${LIMITE}`).toBe(200);
  }

  const debordement = await page.request.post("/api/vins/etiquette/read", { multipart: etiquette() });
  expect(debordement.status()).toBe(429);
  expect((await debordement.json()).error).toBe("trop_de_demandes");
});

test("la limite d'un compte ne ferme pas la porte aux autres", async ({ page }) => {
  // Le compte de la rafale est déjà saturé par le test précédent (même
  // minute, même fenêtre) : c'est justement ce qu'on veut vérifier ici.
  await login(page, "client@vito.test");
  const r = await page.request.post("/api/vins/etiquette/read", { multipart: etiquette() });
  expect(r.status()).toBe(200);
});
