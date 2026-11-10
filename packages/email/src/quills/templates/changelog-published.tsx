import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
/* oxlint-disable react/no-danger -- Preserve the rich-email contract; callers must supply trusted, sanitized HTML. */
import { Section, Text } from "@react-email/components";
import { EmailLayout, NotificationFooter } from "./email-layout";
import { typography } from "./shared-styles";

interface ChangelogPublishedEmailProps {
  changelogTitle: string;
  changelogUrl: string;
  contentPreview: string;
  /**
   * The entry's full body as pre-rendered, sanitized HTML (from the entry's
   * rich content, or its markdown content rendered the same way). When present
   * it replaces the truncated `contentPreview` excerpt so the reader gets the
   * whole update — formatting and inline images — without leaving their inbox.
   * Absent = fall back to the preview excerpt.
   */
  bodyHtml?: string;
  organizationName: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

export function ChangelogPublishedEmail({
  changelogTitle,
  changelogUrl,
  contentPreview,
  bodyHtml,
  organizationName,
  unsubscribeUrl,
  preferencesUrl,
  logoUrl,
}: ChangelogPublishedEmailProps) {
  return (
    <EmailLayout
      footer={
        <NotificationFooter
          reason="You received this email because you're subscribed to changelog updates."
          unsubscribeUrl={unsubscribeUrl}
          preferencesUrl={preferencesUrl}
        />
      }
      preview={`New update from ${organizationName}: ${changelogTitle}`}
      logoUrl={logoUrl}
      logoAlt={organizationName}
    >
      {/* Content */}
      <EmailIntro title="New update published" />
      <Text className="k-text-85" style={typography.text}>
        {organizationName} just published a product update.
      </Text>

      {/* Changelog Title */}
      <>
        <Frame title="Product update">
          <Text
            className="k-text-85"
            style={{
              ...typography.text,
              marginTop: "0",
              marginBottom: "0",
              fontWeight: "600",
            }}
          >
            {changelogTitle}
          </Text>
        </Frame>
        <Spacer size={20} />
      </>

      {/* Full entry body */}
      {bodyHtml ? (
        // Pre-sanitized upstream (write-time TipTap sanitizer + serializer
        // escaping); email clients get no live DOM, so this is the same
        // controlled HTML the app renders server-side.
        <div
          className="k-text-85"
          style={{ ...typography.text, marginBottom: "0" }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        contentPreview && (
          <Text
            className="k-text-85"
            style={{
              ...typography.textSmall,
              marginTop: "0",
              marginBottom: "0",
            }}
          >
            {contentPreview}
          </Text>
        )
      )}

      {/* CTA Button */}
      <Section
        style={{ textAlign: "start", marginTop: "32px", marginBottom: "32px" }}
      >
        <EmailButton href={changelogUrl}>View Update</EmailButton>
      </Section>

      {/* Footer */}
    </EmailLayout>
  );
}
