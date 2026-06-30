import { createServerSupabase } from "@/lib/supabase/server";
import { rechercheRestos, type RestoResult } from "@/features/reco/data/queries";
import { monthRange } from "./monthRange";

type ActivityItem = { type: "resto" | "voyage" | "vin" | "depense"; label: string; at: string };

function embedName(v: unknown): string {
  // un embed supabase peut être un objet ou un tableau
  const e = Array.isArray(v) ? v[0] : v;
  return (e && typeof e === "object" && "nom" in e ? String((e as { nom: unknown }).nom) : "") || "";
}

export async function getDashboardData() {
  const supabase = await createServerSupabase();
  // Fail-safe anon : le layout (app) garde déjà l'accès via requireRole, mais layout
  // et page rendent EN PARALLÈLE dans l'App Router — le redirect du layout ne bloque
  // donc pas cette requête. Sans session valide (fenêtre de refresh / prefetch), le
  // client tombe en rôle `anon` et liste_items renvoie 42501 (GRANT authenticated-only
  // + RLS owner), ce qui crashe le RSC. On court-circuite comme rechercheRestos.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      kpis: { sorties: 0, nouveauxRestos: 0, vinsGoutes: 0, depensesVoyageCents: 0 },
      todo: { restosATester: 0, voyagesAVenir: 0, conciergerieEnAttente: 0 },
      discoveries: [] as { title: string; source: string }[],
      activity: [] as ActivityItem[],
    };
  }
  const now = new Date();
  const { start, end } = monthRange(now);
  const today = now.toISOString().slice(0, 10);

  const [
    sorties,
    nouveauxRestos,
    vinsGoutes,
    restosATester,
    voyagesAVenir,
    conciergerieEnAttente,
    depensesRes,
    recentRestos,
    recentVoyages,
    recentVins,
    recentDepenses,
    recos,
  ] = await Promise.all([
    supabase
      .from("liste_items")
      .select("id", { count: "exact", head: true })
      .eq("statut", "visite")
      .gte("added_at", start)
      .lt("added_at", end),
    supabase
      .from("liste_items")
      .select("id", { count: "exact", head: true })
      .gte("added_at", start)
      .lt("added_at", end),
    supabase
      .from("degustations")
      .select("id", { count: "exact", head: true })
      .gte("deguste_le", start)
      .lt("deguste_le", end),
    supabase
      .from("liste_items")
      .select("id", { count: "exact", head: true })
      .eq("statut", "a_faire")
      .eq("is_archived", false),
    supabase
      .from("voyages")
      .select("id", { count: "exact", head: true })
      .in("statut", ["planifie", "confirme"])
      .gte("date_debut", today),
    supabase
      .from("conciergerie_demandes")
      .select("id", { count: "exact", head: true })
      .in("statut", ["nouvelle", "en_cours"]),
    supabase
      .from("depenses")
      .select("montant_cents")
      .gte("date", start)
      .lt("date", end),
    supabase
      .from("liste_items")
      .select("added_at, etablissement:etablissements(nom)")
      .order("added_at", { ascending: false })
      .limit(5),
    supabase
      .from("voyages")
      .select("titre, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("degustations")
      .select("created_at, vin:vins(nom)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("depenses")
      .select("libelle, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    rechercheRestos({}).catch(
      (): { recos: RestoResult[] } => ({ recos: [] }),
    ),
  ]);

  const depensesVoyageCents = (depensesRes.data ?? []).reduce(
    (s, r) => s + r.montant_cents,
    0,
  );

  const activity: ActivityItem[] = [
    ...(recentRestos.data ?? []).map((r) => ({
      type: "resto" as const,
      label: embedName(r.etablissement),
      at: r.added_at,
    })),
    ...(recentVoyages.data ?? []).map((r) => ({
      type: "voyage" as const,
      label: r.titre,
      at: r.created_at,
    })),
    ...(recentVins.data ?? []).map((r) => ({
      type: "vin" as const,
      label: embedName(r.vin),
      at: r.created_at,
    })),
    ...(recentDepenses.data ?? []).map((r) => ({
      type: "depense" as const,
      label: r.libelle,
      at: r.created_at,
    })),
  ]
    .filter((a) => a.label)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 6);

  const discoveries = recos.recos.slice(0, 3).map((r) => ({
    title: r.nom,
    source: r.ville ?? r.type ?? "",
  }));

  return {
    kpis: {
      sorties: sorties.count ?? 0,
      nouveauxRestos: nouveauxRestos.count ?? 0,
      vinsGoutes: vinsGoutes.count ?? 0,
      depensesVoyageCents,
    },
    todo: {
      restosATester: restosATester.count ?? 0,
      voyagesAVenir: voyagesAVenir.count ?? 0,
      conciergerieEnAttente: conciergerieEnAttente.count ?? 0,
    },
    discoveries,
    activity,
  };
}
