"use client";

import { useLayoutEffect } from "react";

export function ThemeSync() {
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("kaneo-site-theme");
      } catch {
        // Follow the system appearance when storage is unavailable.
      }
      const isDark = stored === "dark" || (stored !== "light" && media.matches);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };

    // React can clear the root attributes during hydration. Restore them before
    // the browser paints, then keep system appearance changes in sync.
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, []);

  return null;
}
