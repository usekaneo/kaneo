import { useEffect } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useUserPreferencesStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    let resolvedTheme: "light" | "dark";
    if (theme === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      resolvedTheme = theme;
    }
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        root.classList.remove("light", "dark");
        const nextTheme = e.matches ? "dark" : "light";
        root.classList.add(nextTheme);
        root.style.colorScheme = nextTheme;
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return <>{children}</>;
}
