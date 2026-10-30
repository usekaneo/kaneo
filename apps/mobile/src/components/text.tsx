import { Text, type TextProps, type TextStyle } from "react-native";

import { font, useColors } from "@/theme";

type Variant =
  | "display" // 34 wordmark
  | "title" // 28 screen titles
  | "h2" // 24 task title
  | "h3" // 18 sheet titles
  | "section" // 15 semibold section headers
  | "card" // 16 card titles
  | "body" // 15 rows and inputs
  | "bodySm" // 14
  | "meta" // 13
  | "caption" // 12
  | "micro" // 11
  | "mono" // 11 task ids
  | "monoMd"; // 13

type Tone =
  | "ink"
  | "ink2"
  | "body"
  | "muted"
  | "faint"
  | "placeholder"
  | "danger"
  | "onPrimary"
  | "link"
  | "done";

const variants: Record<Variant, TextStyle> = {
  display: {
    fontFamily: font.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
  },
  title: {
    fontFamily: font.semibold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
  },
  h2: {
    fontFamily: font.semibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.48,
  },
  h3: {
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
  },
  section: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  card: {
    fontFamily: font.medium,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.16,
  },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 20 },
  bodySm: { fontFamily: font.regular, fontSize: 14, lineHeight: 18 },
  meta: { fontFamily: font.regular, fontSize: 13, lineHeight: 16 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
  mono: { fontFamily: font.mono, fontSize: 11, lineHeight: 14 },
  monoMd: { fontFamily: font.mono, fontSize: 13, lineHeight: 18 },
};

const weights = {
  regular: font.regular,
  medium: font.medium,
  semibold: font.semibold,
  bold: font.bold,
} as const;

export type TxtProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  weight?: keyof typeof weights;
  color?: string;
  center?: boolean;
  strike?: boolean;
};

export function Txt({
  variant = "body",
  tone = "ink",
  weight,
  color,
  center,
  strike,
  style,
  ...rest
}: TxtProps) {
  const c = useColors();
  const tones: Record<Tone, string> = {
    ink: c.ink,
    ink2: c.ink2,
    body: c.body,
    muted: c.muted,
    faint: c.faint,
    placeholder: c.placeholder,
    danger: c.danger,
    onPrimary: c.onPrimary,
    link: c.link,
    done: c.successFg,
  };
  const isMono = variant === "mono" || variant === "monoMd";
  return (
    <Text
      {...rest}
      style={[
        variants[variant],
        { color: color ?? tones[tone] },
        weight && !isMono ? { fontFamily: weights[weight] } : null,
        center ? { textAlign: "center" } : null,
        strike ? { textDecorationLine: "line-through" } : null,
        style,
      ]}
    />
  );
}
