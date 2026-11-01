import { Text } from "react-email";
import React from "react";
import { Section } from "./section";
import { colors, shadow } from "./tokens";

void React;

type OtpCodeProps = {
  code: string;
  label: string;
  hint: string;
};

export function OtpCode({ code, label, hint }: OtpCodeProps) {
  return (
    <Section style={wrapper}>
      <Text className="k-text" style={labelStyle}>
        {label}
      </Text>
      <Text className="k-slot" style={codeStyle}>
        {code}
      </Text>
      <Text className="k-muted" style={hintStyle}>
        {hint}
      </Text>
    </Section>
  );
}

const wrapper = {
  margin: "0 0 32px",
};

const labelStyle = {
  margin: "0 0 8px",
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "16px",
  fontWeight: "500",
};

const codeStyle = {
  margin: "0",
  padding: "14px 16px",
  textAlign: "center" as const,
  textIndent: "0.35em",
  letterSpacing: "0.35em",
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: "28px",
  lineHeight: "32px",
  fontWeight: "600",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.input,
  borderRadius: "8px",
  backgroundColor: colors.background,
  boxShadow: shadow,
  color: colors.foreground,
  userSelect: "all" as const,
  WebkitUserSelect: "all" as const,
};

const hintStyle = {
  margin: "8px 0 0",
  color: colors.mutedForeground,
  fontSize: "14px",
  lineHeight: "20px",
};
