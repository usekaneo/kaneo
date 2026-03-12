import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

void React;

type EmailShellProps = {
  preview: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function EmailShell({
  preview,
  title,
  subtitle,
  children,
}: EmailShellProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={content}>
            <Text style={badge}>Kaneo</Text>
            <Heading style={heading}>{title}</Heading>
            {subtitle ? <Text style={subtitleText}>{subtitle}</Text> : null}
            <Section style={body}>{children}</Section>
          </Section>
        </Container>
      </Body>
    </Html>
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
    border: "1px solid #262626",
    color: "#fafafa",
    backgroundColor: "#262626",
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

const main = {
  backgroundColor: "#ffffff",
  margin: "0",
  padding: "20px 12px",
  fontFamily:
    '"Cal Sans UI", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  margin: "0 auto",
  maxWidth: "560px",
  borderRadius: "16px",
  border: "1px solid rgba(0, 0, 0, 0.08)",
  overflow: "hidden",
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
};

const content = {
  padding: "24px",
};

const badge = {
  margin: "0 0 8px",
  color: "#262626",
  fontWeight: "600",
  fontSize: "12px",
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

const heading = {
  margin: "0 0 8px",
  color: "#262626",
  fontSize: "24px",
  lineHeight: "31px",
  fontFamily:
    '"Cal Sans Heading", "Cal Sans UI", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const subtitleText = {
  margin: "0 0 18px",
  color: "#525252",
  fontSize: "14px",
  lineHeight: "22px",
};

const body = {
  margin: "0",
};
