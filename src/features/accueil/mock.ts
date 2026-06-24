import type { Tone } from "@/features/shared/ui/helpers";

export const SORTIES_THIS_MONTH = 12;

export const MONTHLY_KPIS: { key: string; tone: Tone; value: string | number }[] = [
  { key: "sorties", tone: "blue", value: 12 },
  { key: "nouveauxRestos", tone: "green", value: 4 },
  { key: "vinsGoutes", tone: "violet", value: 7 },
  { key: "depensesVoyage", tone: "amber", value: "320 €" },
];

export const TODO: { key: string; count: number }[] = [
  { key: "restosATester", count: 5 },
  { key: "voyagesAVenir", count: 2 },
  { key: "vinsARacheter", count: 3 },
];

export const DISCOVERIES: { title: string; source: string }[] = [
  { title: "Le Clarence", source: "Recommandé par Marie" },
  { title: "Trattoria da Gigi", source: "Tendance ce mois" },
  { title: "Château Margaux 2015", source: "Coup de cœur sommelier" },
];

export const ACTIVITY: { title: string; ago: string }[] = [
  { title: "« Septime » ajouté à tester", ago: "il y a 1h" },
  { title: "Voyage « Rome » mis à jour", ago: "hier" },
  { title: "Vin « Chablis » noté ★★★★", ago: "il y a 3 j" },
];
