import { colors as tokens, fontFamily, shadow } from "../../components/tokens";

export const colors = {
  primary: tokens.primary,
  primaryDark: tokens.foreground95,
  heading: tokens.foreground,
  text: tokens.foreground85,
  textMuted: tokens.mutedForeground,
  textLight: tokens.mutedForeground,
  background: tokens.background,
  surface: tokens.background,
  surfaceMuted: tokens.frame,
  border: tokens.border,
};

export const typography = {
  h1: {
    color: colors.heading,
    fontSize: "24px",
    fontWeight: "600",
    lineHeight: "32px",
    letterSpacing: "-0.6px",
    margin: "0 0 10px",
  },
  h2: {
    color: colors.heading,
    fontSize: "18px",
    fontWeight: "600",
    lineHeight: "26px",
    letterSpacing: "-0.3px",
    margin: "0 0 8px",
  },
  text: {
    color: colors.text,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 24px",
  },
  textSmall: {
    color: colors.textMuted,
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 16px",
  },
  footer: {
    color: colors.textMuted,
    fontSize: "12px",
    lineHeight: "18px",
    margin: "24px 0 0",
  },
};

export const utils = {
  divider: { borderTop: `1px solid ${colors.border}`, margin: "24px 0" },
  link: {
    color: tokens.foreground,
    textDecoration: "underline",
    fontWeight: "500",
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: "8px",
    border: `1px solid ${tokens.input}`,
    padding: "14px 16px",
    textAlign: "center" as const,
    boxShadow: shadow,
  },
  code: {
    color: colors.heading,
    fontSize: "28px",
    lineHeight: "32px",
    fontWeight: "600",
    letterSpacing: "0.35em",
    textIndent: "0.35em",
    fontFamily: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
    margin: "0",
    userSelect: "all" as const,
    WebkitUserSelect: "all" as const,
  },
};

export { fontFamily };
