import { useUserPreferencesStore } from "@/store/user-preferences";
import { useEffect } from "react";

export function useUserPreferencesEffects() {
  const { compactMode, theme } = useUserPreferencesStore();

  useEffect(() => {
    const root = document.documentElement;

    if (compactMode) {
      root.classList.add("compact-mode");
    } else {
      root.classList.remove("compact-mode");
    }

    return () => {
      root.classList.remove("compact-mode");
    };
  }, [compactMode]);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("theme-light", "theme-dark", "theme-system");

    root.classList.add(`theme-${theme}`);

    return () => {
      root.classList.remove("theme-light", "theme-dark", "theme-system");
    };
  }, [theme]);

  return {
    compactMode,
    theme,
  };
}
