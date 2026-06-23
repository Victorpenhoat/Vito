"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const t = useTranslations("shell");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Sync the real theme after hydration (must run post-mount to avoid a
    // server/client render mismatch on the icon).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync browser-only theme post-hydration
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next};path=/;max-age=31536000`;
    setTheme(next);
  };

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={t("theme")}
      className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-hover"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
