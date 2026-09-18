import React from "react";
import { type EmailBrand, MotherLayout } from "../layout/mother";
import { palette } from "../layout/theme";

void React;

type EmailShellProps = {
  preview: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  brand?: EmailBrand;
};

/** The older templates' entry point, now drawn by the shared mother layout. */
export function EmailShell({
  preview,
  title,
  subtitle,
  children,
  brand,
}: EmailShellProps) {
  return (
    <MotherLayout
      brand={brand}
      preview={preview}
      heading={title}
      intro={subtitle}
    >
      {children}
    </MotherLayout>
  );
}

export const styles = {
  paragraph: {
    margin: "0 0 14px",
    color: "#262626",
    fontSize: "14px",
    lineHeight: "22px",
  },
  muted: {
    margin: "0",
    color: "#737373",
    fontSize: "13px",
    lineHeight: "20px",
  },
  button: {
    display: "inline-block",
    margin: "8px 0 14px",
    padding: "11px 20px",
    borderRadius: "10px",
    border: `1px solid ${palette.accent}`,
    color: "#ffffff",
    backgroundColor: palette.accent,
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: "600",
    boxShadow: "inset 0 1px rgba(255, 255, 255, 0.16)",
  },
  code: {
    margin: "6px 0 14px",
    textAlign: "center" as const,
    padding: "14px 20px",
    borderRadius: "10px",
    border: "1px solid rgba(0, 0, 0, 0.1)",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    color: "#171717",
    fontSize: "30px",
    letterSpacing: "8px",
    fontWeight: "600",
  },
  divider: {
    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
    margin: "16px 0",
  },
  footer: {
    margin: "0",
    color: "#737373",
    fontSize: "12px",
    lineHeight: "18px",
  },
};
