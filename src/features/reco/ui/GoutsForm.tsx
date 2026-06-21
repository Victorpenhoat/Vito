"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveGouts } from "../data/actions";

type Tag = { slug: string; label: string };
type Initial = { ambiances: string[]; budgetMax: number | null; typesPreferes: string[]; zones: string[] };
const TYPES = ["étoilé", "bistrot", "brasserie", "café", "restaurant"] as const;

export function GoutsForm({ tags, initial }: { tags: Tag[]; initial: Initial }) {
  const t = useTranslations("gouts");
  const [state, action, pending] = useActionState(saveGouts, undefined);
  return (
    <form action={action} data-testid="gouts-form" className="flex flex-col gap-4 max-w-xl">
      <p className="text-gray-600">{t("intro")}</p>
      <fieldset>
        <legend className="font-semibold">{t("ambiances")}</legend>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <label key={tag.slug} className="flex items-center gap-1">
              <input type="checkbox" name="ambiances" value={tag.slug} defaultChecked={initial.ambiances.includes(tag.slug)} />
              {tag.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-semibold">{t("types")}</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((ty) => (
            <label key={ty} className="flex items-center gap-1">
              <input type="checkbox" name="typesPreferes" value={ty} defaultChecked={initial.typesPreferes.includes(ty)} />
              {ty}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col">{t("budget")}
        <input name="budgetMax" type="number" min={0} step="1" defaultValue={initial.budgetMax ?? ""} className="border p-2" />
      </label>
      <label className="flex flex-col">{t("zones")}
        <input name="zones" defaultValue={initial.zones.join(", ")} className="border p-2" />
      </label>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-green-700">{t("saved")}</p>}
      <button type="submit" disabled={pending} className="bg-black text-white p-2">{t("save")}</button>
    </form>
  );
}
