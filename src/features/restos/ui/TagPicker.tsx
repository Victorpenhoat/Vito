"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setTags } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";
import { Checkbox } from "@/features/shared/ui/Checkbox";

type Tag = {
  id: string;
  slug: string;
  label: string;
  color?: string | null;
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
          <Checkbox
            key={tag.id}
            name="tagIds"
            value={tag.id}
            defaultChecked={appliedTagIds.includes(tag.id)}
            label={<>
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={tag.color ? { backgroundColor: tag.color } : { backgroundColor: "#d1d5db" }}
              />
              {tag.label}
            </>}
          />
        ))}
      </div>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      {state && "ok" in state && state.ok && (
        <p data-testid="tags-saved" className="text-green-700">{t("tagsSaved")}</p>
      )}
      <Button type="submit" variant="subtle" pending={pending} className="self-start">
        {t("saveTags")}
      </Button>
    </form>
  );
}
