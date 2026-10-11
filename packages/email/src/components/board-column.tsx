import { Text } from "@react-email/components";
import React from "react";
import { Section } from "./section";
import { ThemedImg } from "./themed-img";
import { colors, shadow } from "./tokens";

void React;

export type BoardColumnIcon =
  | "circle"
  | "circle-dot"
  | "circle-dashed"
  | "search"
  | "check-circle"
  | "archive";

type BoardColumnProps = {
  name: string;
  icon?: BoardColumnIcon;
  count?: number;
  children: React.ReactNode;
};

export function BoardColumn({
  name,
  icon = "circle",
  count,
  children,
}: BoardColumnProps) {
  return (
    <Section className="k-column" style={column}>
      <Section className="k-divider" style={header}>
        <Text style={headerText}>
          <ThemedImg
            name={`column-${icon}`}
            width={16}
            height={16}
            style={iconStyle}
          />
          <span className="k-text-95" style={nameStyle}>
            {name}
          </span>
          {count !== undefined ? (
            <span className="k-chip k-muted" style={countStyle}>
              {count}
            </span>
          ) : null}
        </Text>
      </Section>
      <Section style={body}>{children}</Section>
    </Section>
  );
}

const column = {
  width: "100%",
  maxWidth: "320px",
  margin: "0",
  borderRadius: "14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.columnBorder,
  backgroundColor: colors.column,
  boxShadow: shadow,
};

const header = {
  padding: "8px 12px",
  borderWidth: "0 0 1px",
  borderStyle: "solid",
  borderColor: colors.columnHeaderBorder,
};

const headerText = {
  margin: "0",
  fontSize: "14px",
  lineHeight: "20px",
};

const iconStyle = {
  marginRight: "8px",
  verticalAlign: "-3px",
};

const nameStyle = {
  color: colors.foreground95,
  fontWeight: "500",
};

const countStyle = {
  display: "inline-block",
  marginLeft: "8px",
  padding: "2px 6px",
  borderRadius: "8px",
  backgroundColor: colors.muted,
  color: colors.mutedForeground,
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: "500",
};

const body = {
  padding: "8px",
};
