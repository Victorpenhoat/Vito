"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { UserCheck, Copy, Check, X } from "lucide-react";
import { useRouter } from "@/lib/i18n/routing";
import { inviterProche, annulerInvitationProche } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

type Invitation = { id: string; token: string } | null;

// Compte rattaché à un proche (lot 1 « boîte de réception »). C'est ce lien qui
// manquait pour que « un proche voit sa propre fiche » tienne, et c'est lui qui
// permettra de savoir de QUI vient une recommandation.
export function CompteProcheBlock({ familyMemberId, nom, rattache, invitation, locale }: {
  familyMemberId: string;
  nom: string;
  rattache: boolean;
  invitation: Invitation;
  locale: string;
}) {
  const t = useTranslations("famille.compte");
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [lien, setLien] = useState<Invitation>(invitation);
  // L'origine n'existe que dans le navigateur : la lire pendant le rendu
  // casserait l'hydratation, et une hydratation rompue rend toute la page
  // inerte (défaut rencontré au lot Voyages F).
  const [origine, setOrigine] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valeur navigateur, lue après hydratation
    setOrigine(window.location.origin);
  }, []);

  const url = lien ? `${origine}/${locale}/invitation/${lien.token}` : "";

  async function inviter() {
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("familyMemberId", familyMemberId);
    const res = await inviterProche(undefined, fd);
    setEnCours(false);
    if (!("token" in res) || !res.token) {
      setErreur(("error" in res && res.error) || t("echec"));
      return;
    }
    setLien({ id: res.id, token: res.token });
    router.refresh();
  }

  async function annuler() {
    if (!lien) return;
    const fd = new FormData();
    fd.set("invitationId", lien.id);
    const res = await annulerInvitationProche(undefined, fd);
    if (res?.error) { setErreur(res.error); return; }
    setLien(null);
    router.refresh();
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setErreur(t("copieImpossible"));
    }
  }

  if (rattache) {
    return (
      <p data-testid="compte-rattache" className="inline-flex items-center gap-1.5 rounded-full border border-kpi-green/25 bg-kpi-green-bg px-3 py-1.5 text-[11.5px] font-semibold text-kpi-green">
        <UserCheck size={12} aria-hidden />
        {t("rattache")}
      </p>
    );
  }

  return (
    <div data-testid="compte-proche" className="flex flex-col gap-2">
      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}

      {lien ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11.5px] text-muted">{t("lienPret", { nom })}</p>
          <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2">
            <span data-testid="compte-lien" className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">
              {url || `/${locale}/invitation/${lien.token}`}
            </span>
            <button type="button" data-testid="compte-copier" aria-label={t("copier")} onClick={copier}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted focus-visible:outline-2 focus-visible:outline-accent">
              {copie ? <Check size={12} className="text-kpi-green" aria-hidden /> : <Copy size={12} aria-hidden />}
            </button>
            <button type="button" data-testid="compte-annuler" aria-label={t("annuler")} onClick={annuler}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
              <X size={12} aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11.5px] text-muted">{t("aide", { nom })}</p>
          <Button type="button" variant="ghost" data-testid="compte-inviter" pending={enCours} onClick={inviter}>
            {t("inviter")}
          </Button>
        </>
      )}
    </div>
  );
}
