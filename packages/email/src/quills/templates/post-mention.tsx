import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
import { Column, Row, Section, Text } from "@react-email/components";
import { EmailLayout, NotificationFooter } from "./email-layout";
import { typography, colors } from "./shared-styles";

export interface PostMentionEmailProps {
  mentionerName: string;
  postTitle: string;
  /** Paragraph context for the mention. Empty string suppresses the quote block. */
  excerpt: string;
  postUrl: string;
  workspaceName: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

export function PostMentionEmail({
  mentionerName,
  postTitle,
  excerpt,
  postUrl,
  workspaceName,
  unsubscribeUrl,
  preferencesUrl,
  logoUrl,
}: PostMentionEmailProps) {
  const displayName = mentionerName || "Anonymous user";
  const hasExcerpt = excerpt.length > 0;

  return (
    <EmailLayout
      footer={
        unsubscribeUrl ? (
          <NotificationFooter
            reason={`You received this email because you were mentioned in ${workspaceName}.`}
            unsubscribeUrl={unsubscribeUrl}
            preferencesUrl={preferencesUrl}
          />
        ) : (
          <Text className="k-muted" style={typography.footer}>
            You received this email because you were mentioned in{" "}
            {workspaceName}.
          </Text>
        )
      }
      preview={`${displayName} mentioned you in "${postTitle}"`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      {/* Content */}
      <EmailIntro title="You were mentioned" />
      <Text className="k-text-85" style={typography.text}>
        {displayName} mentioned you in {postTitle}.
      </Text>

      {/* Post Title */}
      <>
        <Frame title="Feedback">
          <Text
            className="k-text-85"
            style={{
              ...typography.text,
              marginTop: "0",
              marginBottom: "0",
              fontWeight: "600",
            }}
          >
            {postTitle}
          </Text>
        </Frame>
        <Spacer size={20} />
      </>

      {/* Excerpt — using Row/Column instead of border-left for Outlook compatibility */}
      {hasExcerpt ? (
        <Row style={{ marginBottom: "24px" }}>
          <Column
            style={{
              width: "3px",
              backgroundColor: colors.primary,
              borderRadius: "2px",
            }}
          />
          <Column style={{ paddingLeft: "16px" }}>
            <Text
              className="k-text-85"
              style={{
                ...typography.text,
                marginTop: "0",
                marginBottom: "0",
                fontStyle: "italic",
              }}
            >
              &quot;{excerpt}&quot;
            </Text>
          </Column>
        </Row>
      ) : null}

      {/* CTA Button */}
      <Section
        style={{ textAlign: "start", marginTop: "32px", marginBottom: "32px" }}
      >
        <EmailButton href={postUrl}>View Feedback</EmailButton>
      </Section>
    </EmailLayout>
  );
}
