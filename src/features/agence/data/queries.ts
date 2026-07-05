import { createServerSupabase, getCachedUser } from "@/lib/supabase/server";

export async function getMesClients() {
  const supabase = await createServerSupabase();
  const auth = await getCachedUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("agence_clients")
    .select("client_id, added_at, client:profiles!agence_clients_client_id_fkey(display_name)")
    .eq("agence_id", auth.user.id)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = Array.isArray(r.client) ? r.client[0] : r.client;
    return { client_id: r.client_id, display_name: p?.display_name ?? null, added_at: r.added_at };
  });
}
