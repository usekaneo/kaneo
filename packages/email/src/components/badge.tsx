import React from "react";
import { colors } from "./tokens";

void React;

type BadgeProps = {
  children: React.ReactNode;
};

export function Badge({ children }: BadgeProps) {
  return (
    <span className="k-badge" style={badge}>
      {children}
    </span>
  );
}

const badge = {
  display: "inline-block",
  padding: "0 3px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.input,
  borderRadius: "6px",
  backgroundColor: colors.background,
  color: colors.foreground,
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: "500",
};
