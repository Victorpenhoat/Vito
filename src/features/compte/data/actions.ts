"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { createServerSupabase } from "@/lib/supabase/server";
import { displayNameDepuis, profilSchema } from "../domain/schemas";

export async function updateProfil(_prev: unknown, formData: FormData) {
  const parsed = profilSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) return { error: "Profil invalide" };
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Non authentifié" };
  const { firstName, lastName } = parsed.data;
  // La policy profiles_update_self limite déjà l'écriture à sa propre ligne, et
  // le trigger profiles_role_immutable interdit tout changement de rôle ici.
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName || null,
      display_name: displayNameDepuis(firstName, lastName),
    })
    .eq("id", auth.user.id);
  if (error) { logActionError("compte.updateProfil", error); return { error: "Enregistrement échoué" }; }
  // "layout" : le nom s'affiche dans le shell de toutes les pages.
  revalidatePath("/", "layout");
  return { ok: true as const };
}
