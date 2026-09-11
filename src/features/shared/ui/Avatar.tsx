import { initials } from "./helpers";

const DIM: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-[46px] w-[46px] text-base",
  xl: "h-[72px] w-[72px] text-2xl",
};

export function Avatar({ name, size = "md", color }: { name: string; size?: "sm" | "md" | "lg" | "xl"; color?: string }) {
  return (
    <span
      // Deux textes, parce qu'il y a deux fonds. Sur une teinte de la palette
      // d'avatars, le blanc tient 4,47 à 5,88:1 et --on-fill n'y ferait que
      // 3,19 à 4,19:1 ; sur le repli en accent, c'est exactement l'inverse
      // (2,48:1 contre 7,54:1). Un seul texte pour les deux fonds dégraderait
      // forcément l'un des deux.
      className={`inline-grid place-items-center rounded-full font-semibold ${DIM[size]} ${color ? "text-white" : "bg-accent text-on-fill"}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
