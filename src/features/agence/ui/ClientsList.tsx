"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { delierClient } from "../data/actions";
import { VoyagePourClientForm } from "./VoyagePourClientForm";
import { Card } from "@/features/shared/ui/Card";

type Client = { client_id: string; display_name: string | null; added_at: string };

export function ClientsList({ clients }: { clients: Client[] }) {
  const t = useTranslations("agence");
  const [, delier] = useActionState(delierClient, undefined);
  if (clients.length === 0) return <p className="text-muted">{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {clients.map((c) => (
        <Card key={c.client_id} data-testid="client-row" className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-medium">{c.display_name ?? c.client_id}</span>
            <form action={delier}>
              <input type="hidden" name="clientId" value={c.client_id} />
              <button type="submit" className="text-sm text-accent hover:underline">{t("retirer")}</button>
            </form>
          </div>
          <VoyagePourClientForm clientId={c.client_id} />
        </Card>
      ))}
    </ul>
  );
}
