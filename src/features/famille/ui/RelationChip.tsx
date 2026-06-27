import { useTranslations } from "next-intl";

export function RelationChip({ relation }: { relation: string }) {
  const t = useTranslations("famille");
  return (
    <span className="inline-flex items-center rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent">
      {t(`relations.${relation}`)}
    </span>
  );
}
