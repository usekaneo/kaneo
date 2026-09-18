import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import { font, palette } from "./theme";

void React;

export type EmailBrand = {
  /** Workspace or product name shown at the top. */
  name: string;
  /** Absolute https URL of a square logo. Initials are used without one. */
  logoUrl?: string | null;
  /** Accent for the top bar and buttons, e.g. "#4f46e5". */
  accent?: string | null;
};

export const DEFAULT_BRAND: EmailBrand = { name: "Kaneo" };

export type MotherLayoutProps = {
  brand?: EmailBrand;
  /** Inbox preview line, shown next to the subject. */
  preview: string;
  /** Small label above the heading, e.g. "Leave request". */
  eyebrow?: string | null;
  heading: string;
  /** Plain sentence under the heading. */
  intro?: string | null;
  children?: React.ReactNode;
  /** Why this person got the email. */
  reason?: string | null;
  /** Where to change email settings. */
  manageUrl?: string | null;
  manageLabel?: string;
  /** "Sent by Acme via Kaneo". */
  signature?: string | null;
};

const safeAccent = (accent?: string | null) =>
  accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : palette.accent;

function BrandMark({ brand }: { brand: EmailBrand }) {
  const accent = safeAccent(brand.accent);
  if (brand.logoUrl) {
    return (
      <Img
        src={brand.logoUrl}
        width="32"
        height="32"
        alt={brand.name}
        style={{ borderRadius: "8px", display: "block" }}
      />
    );
  }
  const initials = brand.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <Text
      style={{
        margin: 0,
        width: "32px",
        height: "32px",
        lineHeight: "32px",
        borderRadius: "8px",
        backgroundColor: accent,
        color: "#ffffff",
        fontSize: "13px",
        fontWeight: 700,
        textAlign: "center",
        fontFamily: font,
      }}
    >
      {initials || "K"}
    </Text>
  );
}

/**
 * The one layout every Kaneo email sits in: brand header, a card with an
 * accent bar, the content, and a footer that says why the email came.
 */
export function MotherLayout({
  brand = DEFAULT_BRAND,
  preview,
  eyebrow,
  heading,
  intro,
  children,
  reason,
  manageUrl,
  manageLabel = "Manage email notifications",
  signature,
}: MotherLayoutProps) {
  const accent = safeAccent(brand.accent);
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={outer}>
          <Section style={{ padding: "8px 4px 16px" }}>
            <Row>
              <Column style={{ width: "40px" }}>
                <BrandMark brand={brand} />
              </Column>
              <Column>
                <Text style={brandName}>{brand.name}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={card}>
            <Section
              style={{
                height: "4px",
                backgroundColor: accent,
                lineHeight: "4px",
              }}
            >
              &nbsp;
            </Section>
            <Section style={{ padding: "28px 28px 8px" }}>
              {eyebrow ? (
                <Text style={{ ...eyebrowStyle, color: accent }}>
                  {eyebrow}
                </Text>
              ) : null}
              <Heading as="h1" style={headingStyle}>
                {heading}
              </Heading>
              {intro ? <Text style={introStyle}>{intro}</Text> : null}
            </Section>
            <Section style={{ padding: "0 28px 24px" }}>{children}</Section>
          </Section>

          <Section style={{ padding: "20px 8px 8px" }}>
            {reason ? <Text style={footerText}>{reason}</Text> : null}
            {manageUrl ? (
              <Text style={footerText}>
                <Link href={manageUrl} style={footerLink}>
                  {manageLabel}
                </Link>
              </Text>
            ) : null}
            <Text style={{ ...footerText, color: palette.faint }}>
              {signature ??
                (brand.name === "Kaneo"
                  ? "Sent by Kaneo"
                  : `Sent by ${brand.name} via Kaneo`)}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = {
  backgroundColor: palette.page,
  margin: 0,
  padding: "32px 12px",
  fontFamily: font,
};

const outer = { margin: "0 auto", maxWidth: "580px" };

const brandName = {
  margin: 0,
  color: palette.text,
  fontSize: "15px",
  fontWeight: 600,
  fontFamily: font,
};

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "14px",
  border: `1px solid ${palette.border}`,
  overflow: "hidden" as const,
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

const eyebrowStyle = {
  margin: "0 0 6px",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontFamily: font,
};

const headingStyle = {
  margin: "0 0 10px",
  color: palette.text,
  fontSize: "22px",
  lineHeight: "30px",
  fontWeight: 700,
  fontFamily: font,
};

const introStyle = {
  margin: "0 0 18px",
  color: palette.muted,
  fontSize: "15px",
  lineHeight: "24px",
  fontFamily: font,
};

const footerText = {
  margin: "0 0 6px",
  color: palette.muted,
  fontSize: "12px",
  lineHeight: "18px",
  textAlign: "center" as const,
  fontFamily: font,
};

const footerLink = { color: palette.muted, textDecoration: "underline" };
