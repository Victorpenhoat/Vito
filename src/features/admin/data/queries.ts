import { createServerSupabase } from "@/lib/supabase/server";

export async function getAdminUsers() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAdminSubscriptions() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, status, period, current_period_end")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAdminDemandes() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("conciergerie_demandes")
    .select("id, type, statut, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
