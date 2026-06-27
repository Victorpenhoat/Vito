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
      className={`inline-grid place-items-center rounded-full font-semibold text-white ${DIM[size]} ${color ? "" : "bg-accent"}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
