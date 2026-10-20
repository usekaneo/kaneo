import { Link, Text } from "@react-email/components";
import React from "react";
import { colors } from "./tokens";

void React;

type FallbackLinkProps = {
  label: string;
  href: string;
};

export function FallbackLink({ label, href }: FallbackLinkProps) {
  return (
    <>
      <Text className="k-muted" style={labelStyle}>
        {label}
      </Text>
      <Text style={linkWrapper}>
        <Link href={href} className="k-link" style={link}>
          {href}
        </Link>
      </Text>
    </>
  );
}

const labelStyle = {
  margin: "16px 0 2px",
  color: colors.mutedForeground,
  fontSize: "12px",
  lineHeight: "18px",
};

const linkWrapper = {
  margin: "0 0 32px",
  fontSize: "12px",
  lineHeight: "18px",
  wordBreak: "break-all" as const,
};

const link = {
  color: colors.foreground,
  fontFamily:
    '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  textDecoration: "underline",
};
