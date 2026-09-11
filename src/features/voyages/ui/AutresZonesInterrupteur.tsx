"use client";
import { useRouter } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/features/shared/ui/Checkbox";

/**
 * « Montrer aussi les autres zones » sur le planning.
 *
 * La préférence vit dans un COOKIE, pas dans `localStorage` : les bandes sont
 * dessinées par le rendu SERVEUR, et une préférence que seul le navigateur
 * connaît les ferait apparaître après l'hydratation — un clignotement à chaque
 * ouverture de l'écran. C'est le mécanisme du thème (cf. `[locale]/layout.tsx`).
 *
 * Éteint par défaut : la zone du foyer est ce qu'on vient lire, les deux autres
 * ne sont utiles qu'à qui les cherche (décision PO).
 */
export function AutresZonesInterrupteur({ actif }: { actif: boolean }) {
  const t = useTranslations("voyages.planning");
  const router = useRouter();

  const basculer = (coche: boolean) => {
    // `max-age=0` efface plutôt que d'écrire « 0 » : un cookie absent et un
    // cookie éteint doivent se lire pareil côté serveur.
    document.cookie = coche
      ? "zones_autres=1;path=/;max-age=31536000"
      : "zones_autres=;path=/;max-age=0";
    router.refresh();
  };

  return (
    <Checkbox
      data-testid="autres-zones"
      // NON contrôlée : le serveur donne l'état initial, le navigateur garde
      // ensuite le sien. Contrôlée par `actif`, React remettrait la case dans
      // son ancien état le temps du rafraîchissement — une case qui se
      // décoche toute seule sous le doigt.
      defaultChecked={actif}
      onChange={(e) => basculer(e.target.checked)}
      className="self-start text-[12.5px] text-muted"
      label={t("autresZones")}
    />
  );
}
