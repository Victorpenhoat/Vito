"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { delierClient } from "../data/actions";
import { VoyagePourClientForm } from "./VoyagePourClientForm";

type Client = { client_id: string; display_name: string | null; added_at: string };

export function ClientsList({ clients }: { clients: Client[] }) {
  const t = useTranslations("agence");
  const [, delier] = useActionState(delierClient, undefined);
  if (clients.length === 0) return <p>{t("vide")}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {clients.map((c) => (
        <li key={c.client_id} data-testid="client-row" className="border p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-medium">{c.display_name ?? c.client_id}</span>
            <form action={delier}>
              <input type="hidden" name="clientId" value={c.client_id} />
              <button type="submit" className="underline text-sm">{t("retirer")}</button>
            </form>
          </div>
          <VoyagePourClientForm clientId={c.client_id} />
        </li>
      ))}
    </ul>
  );
}
