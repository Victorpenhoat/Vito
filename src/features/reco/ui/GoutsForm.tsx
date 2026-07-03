"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveGouts } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { Checkbox } from "@/features/shared/ui/Checkbox";

type Tag = { slug: string; label: string };
type Initial = { ambiances: string[]; budgetMax: number | null; typesPreferes: string[]; zones: string[] };
const TYPES = ["étoilé", "bistrot", "brasserie", "café", "restaurant"] as const;

export function GoutsForm({ tags, initial }: { tags: Tag[]; initial: Initial }) {
  const t = useTranslations("gouts");
  const [state, action, pending] = useActionState(saveGouts, undefined);
  return (
    <form action={action} data-testid="gouts-form" className="flex flex-col gap-4 max-w-xl">
      <p className="text-muted">{t("intro")}</p>
      <fieldset>
        <legend className="font-semibold">{t("ambiances")}</legend>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
<Checkbox key={tag.slug} name="ambiances" value={tag.slug} defaultChecked={initial.ambiances.includes(tag.slug)} label={tag.label} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-semibold">{t("types")}</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((ty) => (
<Checkbox key={ty} name="typesPreferes" value={ty} defaultChecked={initial.typesPreferes.includes(ty)} label={ty} />
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col">{t("budget")}
        <input name="budgetMax" type="number" min={0} step="1" defaultValue={initial.budgetMax ?? ""} className="rounded-control border border-line bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-col">{t("zones")}
        <input name="zones" defaultValue={initial.zones.join(", ")} className="rounded-control border border-line bg-surface px-3 py-2" />
      </label>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      {state?.ok && <p className="text-green-700">{t("saved")}</p>}
      <Button type="submit" pending={pending}>{t("save")}</Button>
    </form>
  );
}
