import { createServerSupabase } from "@/lib/supabase/server";
import type { RechercheCriteria } from "../domain/schemas";
import { buildSignauxImplicites } from "../domain/implicit";
import { scoreEtablissement } from "../domain/scoring";

export type RestoResult = {
  id: string;
  nom: string;
  type: string | null;
  ville: string | null;
  arrondissement: string | null;
  price_level: number | null;
  photo_ref: string | null;
};

export async function getGouts() {
  const supabase = await createServerSupabase();
  // Fail-safe anon : GoutsBanner (restos/page) et gouts/page rendent cette lecture
  // pendant que le layout (app) rend EN PARALLÈLE — son requireRole ne garde donc
  // pas la requête. Sans session valide (fenêtre de refresh / prefetch RSC), le
  // client tombe en rôle `anon` et profil_gouts renvoie 42501, ce qui crashe le RSC
  // (flake CI). On court-circuite comme rechercheRestos ; les 2 consommateurs gèrent
  // déjà `null` (banner affiché / champs par défaut).
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from("profil_gouts").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

const PRICE_BY_BUDGET = (b: number): number => (b <= 20 ? 1 : b <= 40 ? 2 : b <= 80 ? 3 : 4);

function matchObjectif(e: RestoResult, c: RechercheCriteria): boolean {
  if (c.type && e.type !== c.type) return false;
  if (c.zone && e.arrondissement !== c.zone && e.ville !== c.zone) return false;
  if (c.budgetMax != null && e.price_level != null && e.price_level > PRICE_BY_BUDGET(c.budgetMax)) return false;
  return true;
}

export async function rechercheRestos(criteria: RechercheCriteria) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { maListe: [], recos: [] };

  // 1) Ta liste : etablissements présents dans liste_items de l'utilisateur
  const { data: liste, error: listeErr } = await supabase
    .from("liste_items")
    .select("etablissement_id, is_favorite, etablissement:etablissements(id, nom, type, ville, arrondissement, price_level, photo_ref)")
    .eq("is_archived", false);
  if (listeErr) throw listeErr;

  const listeEtabs: RestoResult[] = [];
  const favoris: { type: string | null; arrondissement: string | null }[] = [];
  const ownedIds = new Set<string>();
  for (const li of liste ?? []) {
    const e = Array.isArray(li.etablissement) ? li.etablissement[0] : li.etablissement;
    if (!e) continue;
    ownedIds.add(e.id);
    if (li.is_favorite) favoris.push({ type: e.type, arrondissement: e.arrondissement });
    if (matchObjectif(e, criteria)) listeEtabs.push(e);
  }

  // Signaux implicites : favoris + avis bien notés (note >= 4)
  const { data: bonsAvis, error: avisErr } = await supabase
    .from("avis")
    .select("note, etablissement:etablissements(type, arrondissement)")
    .gte("note", 4);
  if (avisErr) throw avisErr;
  const avisBienNotes = (bonsAvis ?? []).map((a) => {
    const e = Array.isArray(a.etablissement) ? a.etablissement[0] : a.etablissement;
    return { type: e?.type ?? null, arrondissement: e?.arrondissement ?? null };
  });
  const implicites = buildSignauxImplicites(favoris, avisBienNotes);

  // 2) Recos complémentaires : pool partagé, pas déjà dans la liste, critères objectifs, scorées
  const { data: gouts } = await supabase
    .from("profil_gouts")
    .select("types_preferes, zones, budget_max")
    .maybeSingle();
  const scoringGouts = {
    typesPreferes: gouts?.types_preferes ?? [],
    zones: gouts?.zones ?? [],
    budgetMax: gouts?.budget_max ?? null,
  };

  const { data: pool, error: poolErr } = await supabase
    .from("etablissements")
    .select("id, nom, type, ville, arrondissement, price_level, photo_ref");
  if (poolErr) throw poolErr;

  const recos = (pool ?? [])
    .filter((e) => !ownedIds.has(e.id))
    .filter((e) => matchObjectif(e, criteria))
    .map((e) => ({ e, s: scoreEtablissement(e, scoringGouts, implicites) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map(({ e }) => e);

  return { maListe: listeEtabs, recos };
}
