import { useEffect } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function useUserPreferencesEffects() {
  const { compactMode } = useUserPreferencesStore();

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

  return {
    compactMode,
  };
}
