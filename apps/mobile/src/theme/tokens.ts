/**
 * Design tokens taken from the Kaneo web app's own theme (shadcn-style CSS variables): neutral ink
 * on white, translucent borders, Geist type, and color only where it carries meaning. Light values
 * come from `:root`, dark values from `.dark`.
 */

export type Palette = {
  ground: string;
  surface: string;
  card: string;
  ink: string;
  ink2: string;
  body: string;
  muted: string;
  faint: string;
  placeholder: string;
  hairline: string;
  divider: string;
  fill: string;
  fillStrong: string;
  input: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  /** Kaneo's `destructive` (red-500): destructive button fills and error rings. */
  dangerRing: string;
  /** Kaneo's info, warning and success colors; the `Fg` variants are for text and icons. */
  info: string;
  infoFg: string;
  warning: string;
  warningFg: string;
  success: string;
  successFg: string;
  successSoft: string;
  /** Primary button fill and the text on it. */
  primary: string;
  onPrimary: string;
  scrim: string;
  mentionBg: string;
  mentionBorder: string;
  mentionText: string;
  link: string;
  toast: string;
  onToast: string;
  ring: string;
  ringSoft: string;
  raised: string;
  raisedPrimary: string;
  overlay: string;
  priorityLow: string;
  priorityMedium: string;
  priorityHigh: string;
  priorityUrgent: string;
  priorityEmpty: string;
};

export const light: Palette = {
  ground: "#FAFAFA",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  ink: "#262626",
  ink2: "#525252",
  body: "#404040",
  muted: "#686868",
  faint: "#8A8A8A",
  placeholder: "#A1A1A1",
  hairline: "#00000014",
  divider: "#0000000F",
  fill: "#0000000A",
  fillStrong: "#0000001A",
  input: "#F5F5F5",
  danger: "#C10007",
  dangerSoft: "#FB2C3614",
  dangerBorder: "#FB2C364D",
  dangerRing: "#FB2C36",
  info: "#2B7FFF",
  infoFg: "#1447E6",
  warning: "#FE9A00",
  warningFg: "#BB4D00",
  success: "#00BC7D",
  successFg: "#007A55",
  successSoft: "#00BC7D1A",
  primary: "#262626",
  onPrimary: "#FAFAFA",
  scrim: "#0000004D",
  mentionBg: "#2B7FFF14",
  mentionBorder: "#2B7FFF40",
  mentionText: "#1447E6",
  link: "#1447E6",
  toast: "#FFFFFF",
  onToast: "#262626",
  ring: "#A1A1A1",
  ringSoft: "#A1A1A13D",
  raised: "0 1px 2px #0000000D, inset 0 -1px 0 #0000000A",
  raisedPrimary: "0 1px 2px #2626263D, inset 0 1px 0 #FFFFFF29",
  overlay: "0 8px 24px #0000000F, 0 2px 6px #0000000A",
  priorityLow: "#2563EB",
  priorityMedium: "#D97706",
  priorityHigh: "#EA580C",
  priorityUrgent: "#DC2626",
  priorityEmpty: "#00000021",
};

export const dark: Palette = {
  ground: "#141414",
  surface: "#191919",
  card: "#191919",
  ink: "#F5F5F5",
  ink2: "#A1A1A1",
  body: "#D4D4D4",
  muted: "#818181",
  faint: "#737373",
  placeholder: "#5C5C5C",
  hairline: "#FFFFFF0F",
  divider: "#FFFFFF0D",
  fill: "#FFFFFF0A",
  fillStrong: "#FFFFFF14",
  input: "#1F1F1F",
  danger: "#FF6467",
  dangerSoft: "#FB2C361F",
  dangerBorder: "#FB2C3659",
  dangerRing: "#FB2C36",
  info: "#2B7FFF",
  infoFg: "#51A2FF",
  warning: "#FE9A00",
  warningFg: "#FFB900",
  success: "#00BC7D",
  successFg: "#00D492",
  successSoft: "#00BC7D24",
  primary: "#F5F5F5",
  onPrimary: "#262626",
  scrim: "#00000099",
  mentionBg: "#2B7FFF24",
  mentionBorder: "#2B7FFF59",
  mentionText: "#51A2FF",
  link: "#51A2FF",
  toast: "#1C1C1C",
  onToast: "#F5F5F5",
  ring: "#737373",
  ringSoft: "#7373733D",
  raised: "inset 0 1px 0 #FFFFFF0A",
  raisedPrimary: "0 1px 2px #00000066, inset 0 1px 0 #FFFFFF",
  overlay: "0 8px 24px #00000066",
  priorityLow: "#60A5FA",
  priorityMedium: "#FBBF24",
  priorityHigh: "#FB923C",
  priorityUrgent: "#E5484D",
  priorityEmpty: "#FFFFFF24",
};

export const font = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  sheet: 20,
  full: 999,
} as const;

/** Horizontal page inset used by every screen so titles, cards and rows share one lane. */
export const inset = 16;
