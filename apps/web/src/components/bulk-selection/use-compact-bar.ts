import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 1023px)";

const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

const getSnapshot = () =>
  typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

export function useCompactBar() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
