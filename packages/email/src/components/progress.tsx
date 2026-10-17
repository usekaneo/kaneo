import { Column } from "@react-email/components";
import React from "react";
import { Row } from "./row";
import { colors } from "./tokens";

void React;

type ProgressProps = {
  label: string;
  value: string;
  percent: number;
};

export function Progress({ label, value, percent }: ProgressProps) {
  const filled = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <>
      <Row>
        <Column className="k-text" style={labelStyle}>
          {label}
        </Column>
        <Column align="right" className="k-text" style={valueStyle}>
          {value}
        </Column>
      </Row>
      <Row className="k-track" style={track}>
        {filled > 0 ? (
          <Column className="k-bar" style={{ ...bar, width: `${filled}%` }}>
            &nbsp;
          </Column>
        ) : null}
        {filled < 100 ? <Column style={rest}>&nbsp;</Column> : null}
      </Row>
    </>
  );
}

const labelStyle = {
  paddingBottom: "8px",
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: "500",
};

const valueStyle = {
  paddingBottom: "8px",
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "20px",
  textAlign: "right" as const,
};

const track = {
  borderRadius: "999px",
  backgroundColor: colors.input,
};

const bar = {
  borderRadius: "999px",
  backgroundColor: colors.primary,
  fontSize: "1px",
  lineHeight: "6px",
};

const rest = {
  fontSize: "1px",
  lineHeight: "6px",
};
