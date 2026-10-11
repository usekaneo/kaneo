import { Button, Img } from "@react-email/components";
import React from "react";
import { emailAsset } from "./assets";
import { colors, fontFamily } from "./tokens";

void React;

type EmailButtonProps = {
  href: string;
  icon?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
};

export function EmailButton({
  href,
  icon,
  fullWidth = false,
  children,
}: EmailButtonProps) {
  return (
    <Button
      href={href}
      className="k-btn"
      style={{
        ...base,
        ...primary,
        ...(fullWidth ? block : null),
      }}
    >
      {icon ? (
        <Img
          src={emailAsset(icon)}
          width="16"
          height="16"
          alt=""
          style={iconStyle}
        />
      ) : null}
      {children}
    </Button>
  );
}

const base = {
  display: "inline-block",
  padding: "7px 11px",
  borderRadius: "10px",
  fontFamily,
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: "500",
  textDecoration: "none",
};

const primary = {
  border: `1px solid ${colors.primary}`,
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 1px 2px rgba(38, 38, 38, 0.24)",
};

const block = {
  display: "block",
  textAlign: "center" as const,
};

const iconStyle = {
  display: "inline-block",
  border: "0",
  mixBlendMode: "difference" as const,
  margin: "0 8px 0 0",
  verticalAlign: "-3px",
  opacity: "0.8",
};
