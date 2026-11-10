import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
import { Column, Row, Section, Text } from "@react-email/components";
import { EmailLayout, NotificationFooter } from "./email-layout";
import { typography, colors } from "./shared-styles";

interface NewCommentEmailProps {
  postTitle: string;
  postUrl: string;
  commenterName: string;
  commentPreview: string;
  isTeamMember: boolean;
  organizationName: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

export function NewCommentEmail({
  postTitle,
  postUrl,
  commenterName,
  commentPreview,
  isTeamMember,
  organizationName,
  unsubscribeUrl,
  preferencesUrl,
  logoUrl,
}: NewCommentEmailProps) {
  return (
    <EmailLayout
      footer={
        <NotificationFooter
          reason="You received this email because you submitted or subscribed to this feedback."
          unsubscribeUrl={unsubscribeUrl}
          preferencesUrl={preferencesUrl}
        />
      }
      preview={`New comment on "${postTitle}"`}
      logoUrl={logoUrl}
      logoAlt={organizationName}
    >
      {/* Content */}
      <EmailIntro title="New comment on your feedback" />
      <Text className="k-text-85" style={typography.text}>
        {commenterName}
        {isTeamMember ? " (Team)" : ""} commented on your feedback in{" "}
        {organizationName}.
      </Text>

      {/* Post Title */}
      <>
        <Frame title="Feedback">
          <Text
            className="k-text-85"
            style={{
              ...typography.textSmall,
              marginTop: "0",
              marginBottom: "4px",
              color: colors.textMuted,
            }}
          >
            Feedback
          </Text>
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

      {/* Comment Preview - using Row/Column instead of border-left for Outlook compatibility */}
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
            &quot;{commentPreview}&quot;
          </Text>
        </Column>
      </Row>

      {/* CTA Button */}
      <Section
        style={{ textAlign: "start", marginTop: "32px", marginBottom: "32px" }}
      >
        <EmailButton href={postUrl}>View Comment</EmailButton>
      </Section>

      {/* Footer */}
    </EmailLayout>
  );
}
