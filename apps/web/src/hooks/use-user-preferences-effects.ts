import { useUserPreferencesStore } from "@/store/user-preferences";
import { useEffect } from "react";

export function useUserPreferencesEffects() {
  const { compactMode, theme } = useUserPreferencesStore();

  // Apply compact mode styles to the document
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

  // Apply theme class for better CSS targeting
  useEffect(() => {
    const root = document.documentElement;

    // Remove any existing theme classes
    root.classList.remove("theme-light", "theme-dark", "theme-system");

    // Add current theme class
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
