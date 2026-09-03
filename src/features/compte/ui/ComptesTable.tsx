"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { suspendreCompte } from "../data/actions";
import { Avatar } from "@/features/shared/ui/Avatar";

type Ligne = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  statut: string;
  creeLe: string;
  vuLe: string | null;
};

const TON: Record<string, string> = {
  actif: "border-current/20 bg-kpi-green-bg text-kpi-green",
  invite: "border-line bg-surface-hover text-muted",
  suspendu: "border-current/20 bg-kpi-amber-bg text-kpi-amber",
  suppression: "border-danger/30 bg-danger/10 text-danger",
  administrateur: "border-accent/25 bg-accent-50 text-accent",
};

// Liste des comptes (écran « Comptes »). Seules l'identité et l'état sont
// affichés : la fonction serveur ne renvoie rien d'autre.
export function ComptesTable({ comptes }: { comptes: Ligne[] }) {
  const t = useTranslations("compte");
  const [state, action, pending] = useActionState(suspendreCompte, undefined);

  return (
    <div className="flex flex-col gap-2">
      {state && "error" in state && state.error && (
        <p role="alert" className="text-sm text-danger">{state.error}</p>
      )}
      <ul data-testid="comptes-liste" className="divide-y divide-line-soft overflow-hidden rounded-[5px] border border-line bg-surface">
        {comptes.map((c) => {
          const nom = c.display_name?.trim() || c.email || "—";
          const suspendu = c.statut === "suspendu";
          const agissable = c.statut !== "administrateur" && c.statut !== "suppression";
          return (
            <li key={c.id} data-testid="compte-row" className="flex flex-wrap items-center gap-3 px-3.5 py-3">
              <Avatar name={nom} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{nom}</span>
                <span className="block truncate text-[11px] text-faint">{c.email ?? "—"}</span>
              </span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TON[c.statut] ?? TON.invite}`}>
                {t(`comptes.statuts.${c.statut}`)}
              </span>
              <span className="hidden shrink-0 text-[11px] text-faint sm:block">
                {t("comptes.creeLe", { date: c.creeLe })}
                {c.vuLe ? ` · ${t("comptes.vuLe", { date: c.vuLe })}` : ` · ${t("comptes.jamaisConnecte")}`}
              </span>
              {agissable && (
                <form action={action} className="shrink-0">
                  <input type="hidden" name="userId" value={c.id} />
                  <input type="hidden" name="suspendre" value={String(!suspendu)} />
                  <button type="submit" data-testid={suspendu ? "compte-reactiver" : "compte-suspendre"}
                    disabled={pending}
                    className="rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[10.5px] font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
                    {suspendu ? t("comptes.reactiver") : t("comptes.suspendre")}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
