"use server";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/actionError";
import { getTranslations } from "next-intl/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { goutsInputSchema } from "../domain/schemas";

function parseList(raw: FormDataEntryValue[] | undefined): string[] {
  if (!raw) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export async function saveGouts(_prev: unknown, formData: FormData) {
  const t = await getTranslations("gouts.errors");
  const parsed = goutsInputSchema.safeParse({
    ambiances: parseList(formData.getAll("ambiances")),
    typesPreferes: parseList(formData.getAll("typesPreferes")),
    zones: parseList(formData.getAll("zones")),
    budgetMax: formData.get("budgetMax") || undefined,
  });
  if (!parsed.success) return { error: t("invalid") };

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: t("notAuth") };

  const { error } = await supabase.from("profil_gouts").upsert(
    {
      user_id: auth.user.id,
      ambiances: parsed.data.ambiances,
      types_preferes: parsed.data.typesPreferes,
      zones: parsed.data.zones,
      budget_max: parsed.data.budgetMax ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) { logActionError("reco.saveGouts", error); return { error: t("saveFailed") }; }

  revalidatePath("/gouts");
  revalidatePath("/recherche");
  return { ok: true as const };
}
