"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setTags } from "../data/actions";

type Tag = {
  id: string;
  slug: string;
  label: string;
};

interface TagPickerProps {
  tags: Tag[];
  appliedTagIds: string[];
  listeItemId: string;
}

export function TagPicker({ tags, appliedTagIds, listeItemId }: TagPickerProps) {
  const t = useTranslations("restos");
  const [state, action, pending] = useActionState(setTags, undefined);
  return (
    <form action={action} data-testid="tag-picker" className="flex flex-col gap-2">
      <input type="hidden" name="listeItemId" value={listeItemId} />
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              name="tagIds"
              value={tag.id}
              defaultChecked={appliedTagIds.includes(tag.id)}
            />
            {tag.label}
          </label>
        ))}
      </div>
      {state?.error && <p role="alert" className="text-red-600">{state.error}</p>}
      {state && "ok" in state && state.ok && (
        <p data-testid="tags-saved" className="text-green-700">{t("tagsSaved")}</p>
      )}
      <button type="submit" disabled={pending} className="underline self-start">
        {t("saveTags")}
      </button>
    </form>
  );
}
