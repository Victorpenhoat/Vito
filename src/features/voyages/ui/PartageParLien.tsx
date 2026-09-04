"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link2, Copy, Check, X } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { creerInvitation, revoquerInvitation } from "@/features/invitations/data/actions";
import { Button } from "@/features/shared/ui/Button";

type Lien = { id: string; token: string; usages: number; usagesMax: number; expireLe: string; creeLe: string };

/** Un lien de voyage sert à un groupe : dix usages, et il expire de lui-même. */
const USAGES_LIEN_VOYAGE = 10;

// Partage par lien (Lot F). Le lien donne accès À CE VOYAGE seulement, et
// exige toujours un compte — décision du chantier Onboarding. Il s'épuise
// (nombre d'usages), expire, et se révoque à tout moment.
export function PartageParLien({ voyageId, liens, locale }: {
  voyageId: string; liens: Lien[]; locale: string;
}) {
  const t = useTranslations("voyages.partageLien");
  const format = useFormatter();
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState<string | null>(null);
  const [crees, setCrees] = useState<Lien[]>([]);
  const [revoques, setRevoques] = useState<string[]>([]);
  // L'origine n'existe que dans le navigateur. La lire pendant le rendu
  // casserait l'hydratation (le serveur écrit autre chose que le client), et
  // une hydratation rompue désactive TOUTE l'interactivité de la page — c'est
  // ce qui empêchait le dépôt de documents ailleurs sur cet écran.
  const [origine, setOrigine] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valeur navigateur, lue après hydratation
    setOrigine(window.location.origin);
  }, []);

  const connus = new Set(liens.map((l) => l.id));
  // Le lien qu'on vient de créer passe en tête : c'est celui qu'on cherche des
  // yeux, et c'est aussi l'ordre du serveur (le plus récent d'abord).
  const visibles = [...crees.filter((l) => !connus.has(l.id)), ...liens].filter((l) => !revoques.includes(l.id));

  // Chemin d'abord (identique serveur et client), URL complète dès que
  // l'origine est connue.
  const chemin = (token: string) => `/${locale}/invitation/${token}`;
  const url = (token: string) => `${origine}${chemin(token)}`;

  async function creer() {
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("roleVise", "invite");
    fd.set("usagesMax", String(USAGES_LIEN_VOYAGE));
    const res = await creerInvitation(undefined, fd);
    setEnCours(false);
    if (!("token" in res) || !res.token) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    // Le jeton n'est renvoyé qu'ici : on l'affiche sans attendre un
    // rafraîchissement, et on le copie dans la foulée si le navigateur le permet.
    const nouveau: Lien = {
      // L'id RÉEL, pas le jeton : c'est lui que la révocation vise.
      id: res.id, token: res.token, usages: 0, usagesMax: USAGES_LIEN_VOYAGE,
      expireLe: res.expireLe, creeLe: "",
    };
    setCrees((l) => [...l, nouveau]);
    await copier(res.token);
    router.refresh();
  }

  async function copier(token: string) {
    try {
      await navigator.clipboard.writeText(url(token));
      setCopie(token);
      // Le retour visuel s'efface tout seul : pas de « copié » figé à l'écran.
      setTimeout(() => setCopie((c) => (c === token ? null : c)), 2500);
    } catch {
      // Presse-papier refusé (contexte non sécurisé, permission) : le lien
      // reste sélectionnable à la main, on ne prétend pas l'avoir copié.
      setErreur(t("copieImpossible"));
    }
  }

  async function revoquer(id: string) {
    const fd = new FormData();
    fd.set("invitationId", id);
    fd.set("voyageId", voyageId);
    const res = await revoquerInvitation(undefined, fd);
    if (res?.error) { setErreur(res.error); return; }
    setRevoques((l) => [...l, id]);
    router.refresh();
  }

  return (
    <div data-testid="partage-lien" className="flex flex-col gap-2">
      <p className="text-[11.5px] text-muted">{t("aide")}</p>
      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}

      {visibles.length > 0 && (
        <ul className="flex flex-col gap-1">
          {visibles.map((l) => (
            <li key={l.id} data-testid="lien-partage" className="flex items-center gap-2 border-b border-line-soft py-2">
              <Link2 size={13} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11px] text-ink">{url(l.token)}</span>
                <span className="block text-[10.5px] text-faint">
                  {t("usages", { restants: Math.max(0, l.usagesMax - l.usages), max: l.usagesMax })}
                  {l.expireLe ? ` · ${t("expire", { date: format.dateTime(new Date(l.expireLe), { dateStyle: "medium" }) })}` : ""}
                </span>
              </span>
              <button type="button" data-testid="lien-copier" aria-label={t("copier")} onClick={() => copier(l.token)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted focus-visible:outline-2 focus-visible:outline-accent">
                {copie === l.token ? <Check size={12} className="text-kpi-green" aria-hidden /> : <Copy size={12} aria-hidden />}
              </button>
              <button type="button" data-testid="lien-revoquer" aria-label={t("revoquer")} onClick={() => revoquer(l.id)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="ghost" data-testid="lien-creer" pending={enCours} onClick={creer}>
        {t("creer")}
      </Button>
    </div>
  );
}
