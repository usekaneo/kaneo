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

export interface NoteMentionEmailProps {
  /** Teammate who wrote the note. */
  authorName: string;
  /** Plain-text note preview. Empty string suppresses the quote block. */
  preview: string;
  /** Admin inbox deep link — the note is internal, so this is never a portal URL. */
  conversationUrl: string;
  workspaceName: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

/**
 * Alert for a teammate @-mentioned in an internal note on a conversation.
 *
 * Agent-facing, so there is no unsubscribe token: the only opt-out is the
 * notification-preferences surface, and the footer links straight to it.
 */
export function NoteMentionEmail({
  authorName,
  preview,
  conversationUrl,
  workspaceName,
  preferencesUrl,
  logoUrl,
}: NoteMentionEmailProps) {
  const displayName = authorName || "A teammate";
  const paragraphs = preview
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <EmailLayout
      footer={
        preferencesUrl ? (
          <NotificationFooter
            reason={`You received this email because you were mentioned in ${workspaceName}.`}
            unsubscribeUrl={preferencesUrl}
            unsubscribeLabel="Manage notification preferences"
          />
        ) : (
          <Text className="k-muted" style={typography.footer}>
            You received this email because you were mentioned in{" "}
            {workspaceName}.
          </Text>
        )
      }
      preview={`${displayName} mentioned you in an internal note`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      <EmailIntro title="You were mentioned in a note" />
      <Text className="k-text-85" style={typography.text}>
        {displayName} mentioned you in an internal note on a conversation.
      </Text>

      {paragraphs.length > 0 && (
        <>
          <Frame title="Internal note">
            <Text
              className="k-text-85"
              style={{
                ...typography.textSmall,
                marginTop: "0",
                marginBottom: "4px",
                color: colors.textMuted,
              }}
            >
              {displayName}
            </Text>
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

      <Text
        className="k-text-85"
        style={{ ...typography.textSmall, color: colors.textMuted }}
      >
        Internal notes are visible to your team only.
      </Text>

      <Section
        style={{ textAlign: "start", marginTop: "32px", marginBottom: "32px" }}
      >
        <EmailButton href={conversationUrl}>Open conversation</EmailButton>
      </Section>
    </EmailLayout>
  );
}
