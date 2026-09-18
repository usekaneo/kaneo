import { Button, Column, Row, Section, Text } from "@react-email/components";
import React from "react";
import { font, palette, type Tone, toneColor } from "./theme";

void React;

export type EmailAction = { label: string; url: string };

/** One strong button, with an optional quieter one beside it. */
export function ActionButtons({
  primary,
  secondary,
  accent,
}: {
  primary?: EmailAction | null;
  secondary?: EmailAction | null;
  accent?: string | null;
}) {
  if (!primary && !secondary) return null;
  const color =
    accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : palette.accent;
  return (
    <Section style={{ margin: "8px 0 4px" }}>
      {primary ? (
        <Button
          href={primary.url}
          style={{
            backgroundColor: color,
            color: "#ffffff",
            borderRadius: "10px",
            padding: "12px 22px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
            fontFamily: font,
            marginRight: "8px",
            marginBottom: "8px",
          }}
        >
          {primary.label}
        </Button>
      ) : null}
      {secondary ? (
        <Button
          href={secondary.url}
          style={{
            backgroundColor: "#ffffff",
            color: palette.text,
            border: `1px solid ${palette.border}`,
            borderRadius: "10px",
            padding: "11px 20px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
            fontFamily: font,
            marginBottom: "8px",
          }}
        >
          {secondary.label}
        </Button>
      ) : null}
    </Section>
  );
}

export type Detail = { label: string; value: string };

/** A soft card with a title and label/value rows: the "what" of an email. */
export function DetailCard({
  title,
  subtitle,
  details = [],
  status,
}: {
  title?: string | null;
  subtitle?: string | null;
  details?: Detail[];
  status?: { label: string; tone: Tone } | null;
}) {
  if (!title && details.length === 0) return null;
  return (
    <Section style={cardStyle}>
      {title || status ? (
        <Row style={{ marginBottom: details.length ? "10px" : 0 }}>
          <Column>
            {title ? <Text style={cardTitle}>{title}</Text> : null}
            {subtitle ? <Text style={cardSubtitle}>{subtitle}</Text> : null}
          </Column>
          {status ? (
            <Column align="right" style={{ width: "1%", whiteSpace: "nowrap" }}>
              <StatusPill label={status.label} tone={status.tone} />
            </Column>
          ) : null}
        </Row>
      ) : null}
      {details.map((detail) => (
        <Row
          key={detail.label}
          style={{ borderTop: `1px solid ${palette.border}` }}
        >
          <Column style={detailLabel}>{detail.label}</Column>
          <Column style={detailValue}>{detail.value}</Column>
        </Row>
      ))}
    </Section>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const color = toneColor[tone];
  return (
    <Text
      style={{
        margin: 0,
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "999px",
        border: `1px solid ${color}`,
        color,
        fontSize: "12px",
        fontWeight: 600,
        fontFamily: font,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Text>
  );
}

/** Someone's own words, like a comment or a reason for leave. */
export function Quote({
  author,
  text,
}: {
  author?: string | null;
  text: string;
}) {
  return (
    <Section
      style={{
        margin: "0 0 16px",
        padding: "12px 16px",
        borderLeft: `3px solid ${palette.border}`,
        backgroundColor: palette.soft,
        borderRadius: "0 8px 8px 0",
      }}
    >
      {author ? (
        <Text style={{ ...paragraph, margin: "0 0 4px", fontWeight: 600 }}>
          {author}
        </Text>
      ) : null}
      <Text style={{ ...paragraph, margin: 0, whiteSpace: "pre-wrap" }}>
        {text}
      </Text>
    </Section>
  );
}

/** A highlighted note: good news, a warning, or something to act on. */
export function Callout({
  tone = "info",
  text,
}: {
  tone?: Tone;
  text: string;
}) {
  const color = toneColor[tone];
  return (
    <Section
      style={{
        margin: "0 0 16px",
        padding: "12px 16px",
        borderRadius: "10px",
        backgroundColor: `${color}12`,
        border: `1px solid ${color}40`,
      }}
    >
      <Text style={{ ...paragraph, margin: 0, color }}>{text}</Text>
    </Section>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

/** A large one-time code, for sign-in emails. */
export function CodeBlock({ code }: { code: string }) {
  return (
    <Text
      style={{
        margin: "4px 0 18px",
        padding: "16px 20px",
        textAlign: "center",
        borderRadius: "12px",
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.soft,
        color: palette.text,
        fontSize: "30px",
        letterSpacing: "10px",
        fontWeight: 700,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      {code}
    </Text>
  );
}

export const paragraph = {
  margin: "0 0 14px",
  color: palette.text,
  fontSize: "14px",
  lineHeight: "22px",
  fontFamily: font,
};

const cardStyle = {
  margin: "0 0 18px",
  padding: "16px 18px",
  borderRadius: "12px",
  border: `1px solid ${palette.border}`,
  backgroundColor: palette.soft,
};

const cardTitle = {
  margin: 0,
  color: palette.text,
  fontSize: "15px",
  lineHeight: "22px",
  fontWeight: 600,
  fontFamily: font,
};

const cardSubtitle = {
  margin: "2px 0 0",
  color: palette.muted,
  fontSize: "13px",
  lineHeight: "20px",
  fontFamily: font,
};

const detailLabel = {
  padding: "8px 12px 8px 0",
  width: "38%",
  color: palette.muted,
  fontSize: "13px",
  lineHeight: "20px",
  fontFamily: font,
  verticalAlign: "top" as const,
};

const detailValue = {
  padding: "8px 0",
  color: palette.text,
  fontSize: "13px",
  lineHeight: "20px",
  fontWeight: 600,
  fontFamily: font,
  verticalAlign: "top" as const,
};
