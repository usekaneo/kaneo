import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import React from "react";
void React;
/* oxlint-disable react/no-danger -- Preserve the rich-email contract; callers must supply trusted, sanitized HTML. */
import { Column, Link, Row, Section, Text } from "@react-email/components";
import { EmailLayout } from "./email-layout";
import { typography, colors, utils } from "./shared-styles";

interface ConversationMessageEmailProps {
  heading: string;
  intro: string;
  senderName: string;
  messagePreview: string;
  /**
   * The full message body as pre-rendered, sanitized HTML (from the message's
   * rich-text content, or the plain-text content wrapped in escaped paragraphs).
   * When present it replaces the truncated `messagePreview` quote so the reader
   * gets the whole reply inline. Absent = fall back to the preview excerpt.
   */
  bodyHtml?: string;
  ctaUrl: string;
  ctaLabel: string;
  organizationName: string;
  reason: string;
  logoUrl?: string;
}

export function ConversationMessageEmail({
  heading,
  intro,
  senderName,
  messagePreview,
  bodyHtml,
  ctaUrl,
  ctaLabel,
  organizationName,
  reason,
  logoUrl,
}: ConversationMessageEmailProps) {
  return (
    <EmailLayout preview={heading} logoUrl={logoUrl} logoAlt={organizationName}>
      <EmailIntro title={heading} />
      <Text className="k-text-85" style={typography.text}>
        {intro}
      </Text>

      <>
        <Frame title="Message">
          <Text
            className="k-text-85"
            style={{
              ...typography.textSmall,
              marginTop: "0",
              marginBottom: "4px",
              color: colors.textMuted,
            }}
          >
            {senderName}
          </Text>
          <Row>
            <Column
              style={{
                width: "3px",
                backgroundColor: colors.primary,
                borderRadius: "2px",
              }}
            />
            <Column style={{ paddingLeft: "16px" }}>
              {bodyHtml ? (
                // The full message body. Pre-sanitized upstream (write-time TipTap
                // sanitizer + serializer escaping); email clients get no live DOM,
                // so this is the same controlled HTML the app renders server-side.
                <div
                  className="k-text-85"
                  style={{ ...typography.text, marginBottom: "0" }}
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              ) : (
                <Text
                  className="k-text-85"
                  style={{
                    ...typography.text,
                    marginTop: "0",
                    marginBottom: "0",
                  }}
                >
                  {messagePreview}
                </Text>
              )}
            </Column>
          </Row>
        </Frame>
        <Spacer size={20} />
      </>

      <Section
        style={{ textAlign: "start", marginTop: "24px", marginBottom: "24px" }}
      >
        <Link
          className="k-link"
          href={ctaUrl}
          style={{ ...utils.link, fontWeight: 500, fontSize: "15px" }}
        >
          {ctaLabel}
        </Link>
      </Section>

      <Text className="k-text-85" style={typography.footer}>
        {reason}
      </Text>
    </EmailLayout>
  );
}
