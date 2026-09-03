"use client";
import { useActionState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react";
import { revoquerAutresSessions, revoquerSession } from "../data/actions";
import { nomAppareil, typeAppareil } from "../domain/appareil";
import type { ConnexionRecente, SessionAppareil } from "../data/sessions";

// Appareils, sessions et connexions récentes (design Onboarding écrans 14 et 15).
// Les données viennent de fonctions serveur limitées à l'appelant : aucune clé
// de service ne circule dans l'application.
export function SessionsSection({ sessions, connexions }: {
  sessions: SessionAppareil[]; connexions: ConnexionRecente[];
}) {
  const t = useTranslations("compte");
  const format = useFormatter();
  const [etatRevoc, revoquer, pendingRevoc] = useActionState(revoquerSession, undefined);
  const [, revoquerTous, pendingTous] = useActionState(
    async () => { await revoquerAutresSessions(); return undefined; },
    undefined,
  );

  const autres = sessions.filter((s) => !s.courante).length;
  const Icone = { mobile: Smartphone, tablette: Tablet, ordinateur: Laptop } as const;

  return (
    <div data-testid="sessions-section" className="flex flex-col gap-3 rounded-[5px] border border-line bg-surface px-3.5 py-3">
      <div>
        <div className="text-[13.5px] text-ink">{t("sessions.titre")}</div>
        <p className="mt-0.5 text-[11.5px] text-muted">{t("sessions.explication")}</p>
      </div>

      {sessions.length === 0 ? (
        <p className="text-[12px] text-muted">{t("sessions.aucune")}</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {sessions.map((s) => {
            const type = typeAppareil(s.user_agent);
            const I = Icone[type];
            const vu = s.refreshed_at ?? s.created_at;
            return (
              <li key={s.id} data-testid="session-row" className="flex items-center gap-3 py-2">
                <I size={15} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{nomAppareil(s.user_agent)}</span>
                  <span className="block text-[11px] text-faint">
                    {t(`sessions.type.${type}`)}
                    {vu ? ` · ${format.dateTime(new Date(vu), { dateStyle: "short", timeStyle: "short" })}` : ""}
                  </span>
                </span>
                {s.courante ? (
                  <span data-testid="session-courante" className="shrink-0 rounded-full border border-accent/25 bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    {t("sessions.cetAppareil")}
                  </span>
                ) : (
                  <form action={revoquer} className="shrink-0">
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button type="submit" data-testid="session-revoquer" disabled={pendingRevoc}
                      className="rounded-full border border-line bg-surface-hover px-2.5 py-1 text-[10.5px] font-semibold text-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
                      {t("sessions.revoquer")}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {etatRevoc && "error" in etatRevoc && etatRevoc.error && (
        <p role="alert" className="text-sm text-danger">{etatRevoc.error}</p>
      )}

      {autres > 0 && (
        <form action={revoquerTous}>
          <button type="submit" data-testid="sessions-revoquer-toutes" disabled={pendingTous}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent disabled:opacity-60">
            <LogOut size={13} aria-hidden /> {t("sessions.deconnecterAutres", { n: autres })}
          </button>
        </form>
      )}

      {connexions.length > 0 && (
        <div className="mt-1 border-t border-line-soft pt-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            {t("sessions.connexionsRecentes")}
          </div>
          <ul data-testid="connexions-recentes" className="mt-1.5 flex flex-col gap-1">
            {connexions.map((c, i) => (
              <li key={`${c.cree_le}-${i}`} className="flex items-baseline justify-between gap-3 text-[11.5px]">
                <span className="text-ink">
                  {c.cree_le ? format.dateTime(new Date(c.cree_le), { dateStyle: "medium", timeStyle: "short" }) : "—"}
                </span>
                <span className="text-faint">{t(`sessions.actions.${c.action ?? "autre"}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10.5px] text-faint">{t("sessions.approximatif")}</p>
        </div>
      )}
    </div>
  );
}
