import { Column } from "@react-email/components";
import React from "react";
import { Row } from "./row";
import { colors } from "./tokens";

void React;

export type DetailRow = {
  label: string;
  value: React.ReactNode;
};

type DetailRowsProps = {
  rows: DetailRow[];
};

export function DetailRows({ rows }: DetailRowsProps) {
  return (
    <>
      {rows.map((row, position) => {
        const divider =
          position < rows.length - 1
            ? {
                borderWidth: "0 0 1px",
                borderStyle: "solid",
                borderColor: colors.border,
              }
            : null;

        return (
          <Row key={row.label}>
            <Column
              className={divider ? "k-muted k-divider" : "k-muted"}
              style={{ ...label, ...divider }}
            >
              {row.label}
            </Column>
            <Column
              align="right"
              className={divider ? "k-text k-divider" : "k-text"}
              style={{ ...value, ...divider }}
            >
              {row.value}
            </Column>
          </Row>
        );
      })}
    </>
  );
}

const cell = {
  padding: "10px 0",
  fontSize: "14px",
  lineHeight: "20px",
};

const label = {
  ...cell,
  paddingRight: "16px",
  whiteSpace: "nowrap" as const,
  color: colors.mutedForeground,
};

const value = {
  ...cell,
  color: colors.foreground,
  fontWeight: "500",
  textAlign: "right" as const,
};
