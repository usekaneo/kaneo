import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
/* oxlint-disable react/no-array-index-key -- Email markup is rendered once; these lines never reorder. */
import { Section, Text } from "@react-email/components";
import { EmailLayout, NotificationFooter } from "./email-layout";
import { typography, colors } from "./shared-styles";

interface TicketEventEmailProps {
  heading: string;
  intro: string;
  /**
   * The full message body as plain text (a reply's markdown rendered to
   * text). Split on blank lines into paragraphs; React escaping keeps it
   * inert. Absent for kinds with no message (status, assignment, SLA).
   */
  messageBody?: string;
  /** Attributed sender for the message block (reply kind). */
  authorName?: string;
  /** Stage transition chip pair (status kinds only). */
  statusChange?: { previousLabel: string | null; newLabel: string };
  /** One-line highlighted fact (SLA kinds: clock + due time). */
  factLine?: string;
  /** Secondary sentence under the intro (e.g. reply-reopens note). */
  note?: string;
  ctaUrl: string;
  ctaLabel: string;
  organizationName: string;
  reason: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

/**
 * The single template behind every ticket lifecycle email; per-kind copy
 * lives in ticketEventCopy() (index.ts). Optional blocks render only when
 * their facts are present, mirroring conversation-message.tsx.
 */
export function TicketEventEmail({
  heading,
  intro,
  messageBody,
  authorName,
  statusChange,
  factLine,
  note,
  ctaUrl,
  ctaLabel,
  organizationName,
  reason,
  preferencesUrl,
  logoUrl,
}: TicketEventEmailProps) {
  const paragraphs = messageBody
    ? messageBody
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <EmailLayout
      footer={
        <NotificationFooter
          reason={reason}
          unsubscribeUrl={preferencesUrl ?? ctaUrl}
          unsubscribeLabel="Manage notification preferences"
        />
      }
      preview={heading}
      logoUrl={logoUrl}
      logoAlt={organizationName}
    >
      <EmailIntro title={heading} />
      <Text className="k-text-85" style={typography.text}>
        {intro}
      </Text>

      {paragraphs.length > 0 && (
        <>
          <Frame title="Reply">
            {authorName && (
              <Text
                className="k-text-85"
                style={{
                  ...typography.textSmall,
                  marginTop: "0",
                  marginBottom: "4px",
                  color: colors.textMuted,
                }}
              >
                {authorName}
              </Text>
            )}
            {paragraphs.map((p, i) => (
              <Text
                className="k-text-85"
                key={i}
                style={{
                  ...typography.text,
                  marginTop: i === 0 ? "0" : "8px",
                  marginBottom: "0",
                }}
              >
                {p}
              </Text>
            ))}
          </Frame>
          <Spacer size={20} />
        </>
      )}

      {statusChange && (
        <Text
          className="k-text-85"
          style={{ ...typography.text, color: colors.textMuted }}
        >
          {statusChange.previousLabel
            ? `${statusChange.previousLabel} → ${statusChange.newLabel}`
            : statusChange.newLabel}
        </Text>
      )}

      {factLine && (
        <>
          <Frame title="Status change">
            <Text
              className="k-text-85"
              style={{ ...typography.text, marginTop: "0", marginBottom: "0" }}
            >
              {factLine}
            </Text>
          </Frame>
          <Spacer size={20} />
        </>
      )}

      {note && (
        <Text
          className="k-text-85"
          style={{ ...typography.textSmall, color: colors.textMuted }}
        >
          {note}
        </Text>
      )}

      <Section
        style={{ textAlign: "start", marginTop: "32px", marginBottom: "32px" }}
      >
        <EmailButton href={ctaUrl}>{ctaLabel}</EmailButton>
      </Section>
    </EmailLayout>
  );
}
