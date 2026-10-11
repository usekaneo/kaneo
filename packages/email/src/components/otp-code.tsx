import { Column, Text } from "@react-email/components";
import React from "react";
import { Row } from "./row";
import { Section } from "./section";
import { colors, shadow } from "./tokens";

void React;

type OtpCodeProps = {
  code: string;
  label: string;
  hint: string;
};

const SLOT_WIDTH = 59;
const SLOT_GAP = 6;

export function OtpCode({ code, label, hint }: OtpCodeProps) {
  const slots = Array.from(code, (digit, slot) => ({ digit, slot }));
  const last = slots.length - 1;

  return (
    <Section style={wrapper}>
      <Text className="k-text" style={labelStyle}>
        {label}
      </Text>
      <Row style={{ maxWidth: `${slots.length * (SLOT_WIDTH + SLOT_GAP)}px` }}>
        {slots.map(({ digit, slot }) => (
          <Column
            key={slot}
            style={{
              width: `${100 / slots.length}%`,
              paddingRight: slot < last ? `${SLOT_GAP}px` : 0,
            }}
          >
            <div className="k-slot" style={slotStyle}>
              {digit}
            </div>
          </Column>
        ))}
      </Row>
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

const slotStyle = {
  lineHeight: "42px",
  textAlign: "center" as const,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.input,
  borderRadius: "8px",
  backgroundColor: colors.background,
  boxShadow: shadow,
  color: colors.foreground,
  fontSize: "14px",
};

const hintStyle = {
  margin: "8px 0 0",
  color: colors.mutedForeground,
  fontSize: "14px",
  lineHeight: "20px",
};
