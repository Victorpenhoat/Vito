import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";
import es from "../../../messages/es.json";

// Contrat des clés ICU de la ligne méta des voyages (« 1 réservations · 1 membres »
// dans l'audit du 03/07) : l'accord singulier/pluriel doit être porté par les messages,
// dans les 4 locales.
const locales = { fr, en, it: it_, es } as const;

const singulier: Record<string, [string, string, string]> = {
  fr: ["1 réservation", "1 membre", "1 document"],
  en: ["1 booking", "1 member", "1 document"],
  it: ["1 prenotazione", "1 membro", "1 documento"],
  es: ["1 reserva", "1 miembro", "1 documento"],
};

const pluriel: Record<string, [string, string, string]> = {
  fr: ["3 réservations", "3 membres", "3 documents"],
  en: ["3 bookings", "3 members", "3 documents"],
  it: ["3 prenotazioni", "3 membri", "3 documenti"],
  es: ["3 reservas", "3 miembros", "3 documentos"],
};

describe.each(Object.keys(locales))("méta voyages — %s", (locale) => {
  // Les messages varient par locale : on sort du typage statique des clés (le test
  // vérifie précisément le contenu réel des 4 fichiers, pas le type d'une seule locale).
  const t = createTranslator({
    locale,
    messages: locales[locale as keyof typeof locales],
    namespace: "voyages",
  } as never) as unknown as (key: string, values?: Record<string, number>) => string;

  it("accorde le singulier (count: 1)", () => {
    expect(t("metaReservations", { count: 1 })).toBe(singulier[locale]![0]);
    expect(t("metaMembres", { count: 1 })).toBe(singulier[locale]![1]);
    expect(t("metaDocuments", { count: 1 })).toBe(singulier[locale]![2]);
  });

  it("accorde le pluriel (count: 3)", () => {
    expect(t("metaReservations", { count: 3 })).toBe(pluriel[locale]![0]);
    expect(t("metaMembres", { count: 3 })).toBe(pluriel[locale]![1]);
    expect(t("metaDocuments", { count: 3 })).toBe(pluriel[locale]![2]);
  });
});
