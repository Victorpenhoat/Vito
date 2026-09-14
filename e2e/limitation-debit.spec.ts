import { test, expect, type Page, type APIResponse } from "@playwright/test";
import { login } from "./helpers";
import { BAREMES } from "../src/lib/securite/quota";

// Audit du 9 septembre : « rate limiting — zéro occurrence ». Ce test prouve
// que la limite existe VRAIMENT au bout de la chaîne (HTTP, pas seulement en
// base), et qu'elle sépare bien les comptes.
//
// Le compte de la rafale est client7b, qui ne sert qu'à l'agence : saturer le
// compte principal ferait tomber les specs de vins et de famille qui lisent
// une étiquette ou une pièce dans la même minute.
const RAFALE = "client7b@vito.test";
const { limite: LIMITE, fenetreSecondes: FENETRE } = BAREMES.lecture_etiquette;
const FENETRE_MS = FENETRE * 1000;

function etiquette() {
  return {
    hint: "un rouge de Loire",
  };
}

function appel(page: Page) {
  return page.request.post("/api/vins/etiquette/read", { multipart: etiquette() });
}

/** Le numéro de la fenêtre courante, calculé comme la migration 00060 le fait. */
function fenetreCourante() {
  return Math.floor(Date.now() / FENETRE_MS);
}

/** Attend l'ouverture de la fenêtre suivante : compteur remis à zéro, minute entière devant. */
function fenetreNeuve(page: Page) {
  return page.waitForTimeout(FENETRE_MS - (Date.now() % FENETRE_MS) + 250);
}

/**
 * Exécute une mesure à l'intérieur d'UNE SEULE fenêtre de quota.
 *
 * Le compteur de la migration 00060 est une fenêtre FIXE : il se remet à zéro
 * à chaque multiple de 60 s, et la migration l'assume — « on tolère jusqu'à
 * deux fois la limite à cheval sur deux fenêtres ». Une rafale qui franchit une
 * frontière recommence donc à compter en son milieu, et le débordement attendu
 * passe en 200. Mesuré le 2026-09-13 : à code identique, treize appels donnent
 * `200 ×12, 429` quand la frontière tombe après, et `200 ×13` quand elle tombe
 * au milieu. La CI l'a payé trois fois le même jour — une fois pour de vrai,
 * puis deux retries condamnés d'avance, qui repartaient dans la même minute sur
 * un compteur déjà brûlé.
 *
 * D'où une mesure VÉRIFIÉE plutôt qu'espérée : on relève la fenêtre avant et
 * après, et `valide` dit si le relevé a du sens (pas de 429 prématuré, donc pas
 * de compteur hérité d'une tentative précédente). Si l'un ou l'autre cloche, on
 * attend l'ouverture d'une fenêtre neuve et on recommence — une fois. Dans une
 * fenêtre propre et longue d'une minute, les mêmes symptômes ne sont plus des
 * artefacts de calendrier mais des défauts du limiteur : on rend le relevé tel
 * quel et ce sont les assertions de l'appelant qui parlent.
 */
async function dansUneFenetre<T>(
  page: Page,
  mesure: () => Promise<T>,
  valide: (releve: T) => boolean,
): Promise<T> {
  const essai = async () => {
    const fenetre = fenetreCourante();
    const releve = await mesure();
    return { releve, memeFenetre: fenetreCourante() === fenetre };
  };

  const premier = await essai();
  if (premier.memeFenetre && valide(premier.releve)) return premier.releve;

  await fenetreNeuve(page);
  const second = await essai();
  expect(
    second.memeFenetre,
    "la mesure a franchi une frontière de fenêtre alors qu'elle avait une minute entière : "
      + "le limiteur, ou la machine, est bien plus lent qu'attendu",
  ).toBe(true);
  return second.releve;
}

// Les deux moitiés de la propriété — la limite mord, et elle ne mord que son
// compte — tiennent dans un seul test parce qu'elles ne valent que MESURÉES
// DANS LA MÊME FENÊTRE. Séparées, la seconde devenait un test vide : elle
// n'affirmait qu'un 200 pour un compte neuf, ce qui passe même sans limiteur.
test("une rafale finit par recevoir 429, et pas avant la limite — et n'enferme que son compte", async ({ page }) => {
  // La reprise en fenêtre neuve peut coûter une minute d'attente.
  test.setTimeout((FENETRE + 60) * 1000);

  const releve = await dansUneFenetre(
    page,
    async () => {
      // La connexion est DANS la mesure : une reprise en fenêtre neuve rejoue
      // tout le bloc, et la page en sort connectée sous l'autre compte. Laissée
      // dehors, la seconde rafale serait tirée par client@ — le compte principal,
      // que les specs de vins et de famille lisent dans la même minute.
      await login(page, RAFALE);
      const rafale: APIResponse[] = [];
      for (let i = 0; i <= LIMITE; i++) rafale.push(await appel(page));
      // Même fenêtre, autre compte : la porte doit rester ouverte.
      await login(page, "client@vito.test");
      const autre = await appel(page);
      return { rafale, autre };
    },
    ({ rafale }) => rafale.slice(0, LIMITE).every((r) => r.status() === 200),
  );

  // Les appels sous la limite passent tous : une limite qui mord trop tôt
  // casserait l'usage normal, ce serait un autre bug.
  for (let i = 1; i <= LIMITE; i++) {
    expect(releve.rafale[i - 1]!.status(), `appel ${i} sur ${LIMITE}`).toBe(200);
  }

  const debordement = releve.rafale[LIMITE]!;
  expect(debordement.status()).toBe(429);
  expect((await debordement.json()).error).toBe("trop_de_demandes");

  expect(releve.autre.status(), "la saturation d'un compte ferme la porte aux autres").toBe(200);
});
