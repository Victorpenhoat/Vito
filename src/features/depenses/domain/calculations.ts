export type Part = { profileId: string; partCents: number };
export type Balance = { profileId: string; soldeCents: number };
export type Transfert = { deProfileId: string; versProfileId: string; montantCents: number };

export function computeParts(
  montantCents: number,
  mode: "egal" | "exact",
  participantIds: string[],
  exactsCents?: Record<string, number>,
): Part[] {
  const ids = [...participantIds].sort((a, b) => a.localeCompare(b));
  if (mode === "exact") {
    const parts = ids.map((profileId) => {
      const partCents = exactsCents?.[profileId];
      if (partCents === undefined) throw new Error(`montant exact manquant pour ${profileId}`);
      return { profileId, partCents };
    });
    const sum = parts.reduce((s, p) => s + p.partCents, 0);
    if (sum !== montantCents) throw new Error("somme des montants exacts != total");
    return parts;
  }
  const n = ids.length;
  const base = Math.floor(montantCents / n);
  const reste = montantCents - base * n;
  return ids.map((profileId, i) => ({ profileId, partCents: base + (i < reste ? 1 : 0) }));
}

export function computeBalances(
  memberIds: string[],
  depenses: { payePar: string; parts: Part[] }[],
  remboursements: Transfert[],
): Balance[] {
  const solde = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const bump = (id: string, delta: number) => solde.set(id, (solde.get(id) ?? 0) + delta);
  for (const d of depenses) {
    const total = d.parts.reduce((s, p) => s + p.partCents, 0);
    bump(d.payePar, total);
    for (const p of d.parts) bump(p.profileId, -p.partCents);
  }
  for (const r of remboursements) {
    bump(r.deProfileId, r.montantCents);
    bump(r.versProfileId, -r.montantCents);
  }
  return [...solde.entries()].map(([profileId, soldeCents]) => ({ profileId, soldeCents }));
}

export function simplifyDebts(balances: Balance[]): Transfert[] {
  const cred = balances.filter((b) => b.soldeCents > 0).map((b) => ({ id: b.profileId, amt: b.soldeCents }));
  const deb = balances.filter((b) => b.soldeCents < 0).map((b) => ({ id: b.profileId, amt: -b.soldeCents }));
  cred.sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  deb.sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  const transferts: Transfert[] = [];
  let i = 0;
  let j = 0;
  while (i < deb.length && j < cred.length) {
    const d = deb[i];
    const c = cred[j];
    if (!d || !c) break;
    const m = Math.min(d.amt, c.amt);
    transferts.push({ deProfileId: d.id, versProfileId: c.id, montantCents: m });
    d.amt -= m;
    c.amt -= m;
    if (d.amt === 0) i++;
    if (c.amt === 0) j++;
  }
  return transferts;
}
