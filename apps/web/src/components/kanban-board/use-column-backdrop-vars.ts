import { useCallback } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";

type ColumnBackdropPreferences = {
  columnOpacity: number;
  columnBlur: number;
};

function applyColumnBackdropVars(
  { style }: HTMLElement,
  { columnOpacity, columnBlur }: ColumnBackdropPreferences,
) {
  style.setProperty("--column-backdrop-opacity", `${columnOpacity}%`);
  style.setProperty("--column-backdrop-blur", `${columnBlur}px`);
}

// Avoid re-render of board by directly writing the CSS variables
export function useColumnBackdropVars() {
  return useCallback((element: HTMLElement | null) => {
    if (!element) return;
    applyColumnBackdropVars(element, useUserPreferencesStore.getState());
    return useUserPreferencesStore.subscribe((state) =>
      applyColumnBackdropVars(element, state),
    );
  }, []);
}
