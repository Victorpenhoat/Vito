"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/features/shared/ui/Button";

export function AjouterDocumentButton({ memberId }: { memberId: string }) {
  const t = useTranslations("famille");
  return (
    <Link href={`/famille/proches/${memberId}/documents/nouveau`}>
      <Button variant="ghost" className="text-sm">{t("tunnel.ajouterDocument")}</Button>
    </Link>
  );
}
