import { useEffect } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, palette } = useUserPreferencesStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (palette === "modern") root.dataset.palette = "modern";
    else delete root.dataset.palette;

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        root.classList.remove("light", "dark");
        root.classList.add(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, palette]);

  return <>{children}</>;
}
