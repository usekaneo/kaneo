import { useColorScheme } from "react-native";

import { dark, light, type Palette } from "./tokens";

export * from "./tokens";

export function useColors(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === "dark";
}

/** Avatar tints from the web app: a soft fill with a darker initial, keyed by name. */
const avatarLight = [
  { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#DBEAFE", fg: "#1E40AF" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#E7E5E4", fg: "#44403C" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
];
const avatarDark = [
  { bg: "#064E3B99", fg: "#6EE7B7" },
  { bg: "#1E3A8A80", fg: "#93C5FD" },
  { bg: "#78350F80", fg: "#FCD34D" },
  { bg: "#3F3F46", fg: "#E4E4E7" },
  { bg: "#83184380", fg: "#F9A8D4" },
  { bg: "#4C1D9580", fg: "#C4B5FD" },
];

export function avatarTint(name: string, isDark: boolean) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const list = isDark ? avatarDark : avatarLight;
  return list[Math.abs(hash) % list.length];
}
