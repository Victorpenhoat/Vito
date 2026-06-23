import { initials } from "./helpers";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={`inline-grid place-items-center rounded-full bg-accent font-semibold text-white ${dim}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
