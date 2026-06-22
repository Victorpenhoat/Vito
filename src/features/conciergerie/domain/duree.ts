// Date de fin = dateDebut (YYYY-MM-DD) + nombreNuits jours, en UTC (déterministe).
export function dureeFromNuits(dateDebut: string, nombreNuits: number): string {
  const d = new Date(`${dateDebut}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + nombreNuits);
  return d.toISOString().slice(0, 10);
}
