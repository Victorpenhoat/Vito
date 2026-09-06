"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { UserPlus, X } from "lucide-react";
import { addParticipant, removeParticipant } from "../data/actions";
import { candidatsCercle, candidatsComptes } from "../domain/participants";
import {
  grouperParticipants, libelleVoyageur, type ParticipantDetaille,
} from "../domain/participantsGroupes";
import { inviterVoyageurExterne } from "../data/actions";
import { Button } from "@/features/shared/ui/Button";

type Proche = { id: string; nom: string };
type Compte = { profileId: string; nom: string };

// « Voyageurs » (Lot B) : qui part. Distinct du partage — un enfant voyage sans
// compte, une agence a un compte sans voyager. Ajouter quelqu'un ici ne lui
// donne AUCUN accès au voyage.
export function ParticipantsList({ voyageId, participants, proches, comptes, aujourdhui }: {
  voyageId: string;
  participants: ParticipantDetaille[];
  proches: Proche[];
  comptes: Compte[];
  /** « YYYY-MM-DD » du rendu serveur : l'âge d'un enfant se calcule, il ne se stocke pas. */
  aujourdhui: string;
}) {
  const t = useTranslations("voyages");
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Affichage optimiste : le rafraîchissement RSC peut ne jamais se commettre
  // sous charge (#71/#77). L'écran montre donc tout de suite ce qui vient
  // d'être écrit, et les props reprennent la main dès qu'elles arrivent.
  const [ajoutes, setAjoutes] = useState<ParticipantDetaille[]>([]);
  const [type, setType] = useState<"adulte" | "enfant">("adulte");
  const [inviteNom, setInviteNom] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [retires, setRetires] = useState<string[]>([]);
  const connus = new Set(participants.map((p) => p.id));
  const visibles = [...participants, ...ajoutes.filter((a) => !connus.has(a.id))]
    .filter((p) => !retires.includes(p.id));

  const { cercle, externes } = grouperParticipants(visibles);
  const cercleDispo = candidatsCercle(proches, visibles);
  const comptesDispo = candidatsComptes(comptes, visibles);
  const leJour = new Date(`${aujourdhui}T00:00:00Z`);

  const sousTitre = (p: ParticipantDetaille) => {
    const l = libelleVoyageur(p, leJour);
    return l.cle === "enfantAge" ? t("participants.enfantAge", { age: l.age }) : t(`participants.${l.cle}`);
  };

  // Action appelée DIRECTEMENT (pas via <form action>) : sous charge, la
  // transition React d'un formulaire peut ne jamais se commettre alors que la
  // donnée est écrite (piège du lot V-C).
  async function ajouter(champs: { displayName: string; familyMemberId?: string; profileId?: string }) {
    // Le type choisi vaut pour l'ajout en cours : la maquette distingue adultes
    // et enfants dès la liste, pas dans un écran de réglage à part.
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("displayName", champs.displayName);
    if (champs.familyMemberId) fd.set("familyMemberId", champs.familyMemberId);
    if (champs.profileId) fd.set("profileId", champs.profileId);
    fd.set("typeVoyageur", type);
    const res = await addParticipant(undefined, fd);
    setEnCours(false);
    if (!("id" in res) || !res.id) {
      setErreur(("error" in res && res.error) || t("participants.echec"));
      return;
    }
    setAjoutes((liste) => [...liste, {
      id: res.id,
      profileId: champs.profileId ?? null,
      familyMemberId: champs.familyMemberId ?? null,
      displayName: champs.displayName,
      email: null,
      role: "voyageur",
      typeVoyageur: type,
      dateNaissance: null,
      invitationEnAttente: false,
    }]);
    setNom("");
    setOuvert(false);
    // L'action a revalidé côté serveur ; hors transition, c'est à nous de
    // demander le nouveau rendu (piège du lot V-C).
    router.refresh();
  }

  async function inviterExterne() {
    setEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("displayName", inviteNom.trim());
    fd.set("email", inviteEmail.trim());
    const res = await inviterVoyageurExterne(undefined, fd);
    setEnCours(false);
    if (!("id" in res) || !res.id) {
      setErreur(("error" in res && res.error) || t("participants.echec"));
      return;
    }
    setAjoutes((liste) => [...liste, {
      id: res.id, profileId: null, familyMemberId: null, displayName: inviteNom.trim(),
      email: inviteEmail.trim(), role: "voyageur", typeVoyageur: "adulte",
      dateNaissance: null, invitationEnAttente: true,
    }]);
    setInviteNom("");
    setInviteEmail("");
    setOuvert(false);
    router.refresh();
  }

  async function retirer(participantId: string) {
    const fd = new FormData();
    fd.set("voyageId", voyageId);
    fd.set("participantId", participantId);
    const res = await removeParticipant(undefined, fd);
    if (res?.error) { setErreur(res.error); return; }
    setRetires((liste) => [...liste, participantId]);
    router.refresh();
  }

  return (
    <div data-testid="participants" className="flex flex-col gap-2">
      {cercle.length === 0 && externes.length === 0 ? (
        <p data-testid="participants-vide" className="text-[12.5px] text-muted">{t("participants.vide")}</p>
      ) : (
        <>
          {/* Deux groupes, comme la maquette : ceux qu'on connaît, et ceux
              qu'on a conviés par e-mail — dont l'invitation peut attendre. */}
          <Groupe titre={t("participants.depuisCercle")} liste={cercle}
            sousTitre={sousTitre} onRetirer={retirer} t={t} testId="groupe-cercle" />
          <Groupe titre={t("participants.groupeExternes")} liste={externes}
            sousTitre={sousTitre} onRetirer={retirer} t={t} testId="groupe-externes" />
        </>
      )}

      {erreur && <p role="alert" className="text-[12px] text-danger">{erreur}</p>}

      {!ouvert ? (
        <button type="button" data-testid="participant-ajouter" onClick={() => setOuvert(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-dashed border-accent/40 bg-accent-50 px-3 py-1.5 text-[11.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent">
          <UserPlus size={12} aria-hidden />
          {t("participants.ajouter")}
        </button>
      ) : (
        <div data-testid="participant-form" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
          {cercleDispo.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("participants.depuisCercle")}</span>
              <div className="flex flex-wrap gap-1.5">
                {cercleDispo.map((pr) => (
                  <button key={pr.id} type="button" data-testid="participant-proche" disabled={enCours}
                    onClick={() => ajouter({ displayName: pr.nom, familyMemberId: pr.id })}
                    className="rounded-full border border-line bg-surface-hover px-3 py-1.5 text-[11.5px] text-ink hover:border-accent/30 disabled:opacity-50">
                    {pr.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          {comptesDispo.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("participants.depuisComptes")}</span>
              <div className="flex flex-wrap gap-1.5">
                {comptesDispo.map((c) => (
                  <button key={c.profileId} type="button" data-testid="participant-compte" disabled={enCours}
                    onClick={() => ajouter({ displayName: c.nom, profileId: c.profileId })}
                    className="rounded-full border border-line bg-surface-hover px-3 py-1.5 text-[11.5px] text-ink hover:border-accent/30 disabled:opacity-50">
                    {c.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("participants.type")}</span>
            {(["adulte", "enfant"] as const).map((v) => (
              <button key={v} type="button" data-testid={`type-${v}`} aria-pressed={type === v}
                onClick={() => setType(v)}
                className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold ${
                  type === v ? "border-accent/30 bg-accent-50 text-accent" : "border-line bg-surface-hover text-muted"
                }`}>
                {t(`participants.${v}`)}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("participants.libre")}</span>
            <div className="flex gap-2">
              <input value={nom} onChange={(e) => setNom(e.target.value)} data-testid="participant-nom"
                placeholder={t("participants.nomPlaceholder")} aria-label={t("participants.nomPlaceholder")}
                onKeyDown={(e) => { if (e.key === "Enter" && nom.trim()) { e.preventDefault(); void ajouter({ displayName: nom.trim() }); } }}
                className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
              <Button type="button" data-testid="participant-valider" pending={enCours}
                onClick={() => { if (nom.trim()) void ajouter({ displayName: nom.trim() }); }}>
                {t("participants.valider")}
              </Button>
            </div>
          </div>
          {/* Invité externe : un nom, une adresse, et le lien part. La maquette
              dit ce qui se passe ensuite — on le répète ici, c'est le moment où
              la question se pose. */}
          <div className="flex flex-col gap-1 border-t border-line-soft pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{t("participants.inviteExterne")}</span>
            <div className="flex flex-wrap gap-2">
              <input value={inviteNom} onChange={(e) => setInviteNom(e.target.value)} data-testid="invite-nom"
                placeholder={t("participants.nomPlaceholder")} aria-label={t("participants.nomPlaceholder")}
                className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="invite-email"
                type="email" placeholder={t("participants.emailPlaceholder")} aria-label={t("participants.emailPlaceholder")}
                className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:outline-2 focus:outline-accent" />
              <Button type="button" data-testid="invite-valider" pending={enCours}
                onClick={() => { if (inviteNom.trim() && inviteEmail.trim()) void inviterExterne(); }}>
                {t("participants.inviter")}
              </Button>
            </div>
            <p className="text-[10.5px] text-faint">{t("participants.aideExterne")}</p>
          </div>

          <p className="text-[10.5px] text-faint">{t("participants.aide")}</p>
        </div>
      )}
    </div>
  );
}

function Groupe({ titre, liste, sousTitre, onRetirer, t, testId }: {
  titre: string;
  liste: ParticipantDetaille[];
  sousTitre: (p: ParticipantDetaille) => string;
  onRetirer: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
  testId: string;
}) {
  if (liste.length === 0) return null;
  return (
    <section data-testid={testId} className="flex flex-col gap-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{titre}</h3>
      <ul className="flex flex-col">
        {liste.map((p) => (
          <li key={p.id} data-testid="participant-row" className="flex items-center gap-2 border-b border-line-soft py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] text-ink">{p.displayName}</span>
              <span className="block truncate text-[11px] text-muted">
                {[sousTitre(p), p.email].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button type="button" data-testid="participant-retirer" aria-label={t("participants.retirer", { nom: p.displayName })}
              onClick={() => onRetirer(p.id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-muted focus-visible:outline-2 focus-visible:outline-accent">
              <X size={11} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
