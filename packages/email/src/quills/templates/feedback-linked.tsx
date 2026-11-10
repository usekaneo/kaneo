import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
import { Section, Text } from "@react-email/components";
import { EmailLayout, NotificationFooter } from "./email-layout";
import { typography } from "./shared-styles";

interface FeedbackLinkedEmailProps {
  recipientName?: string;
  postTitle: string;
  postUrl: string;
  workspaceName: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
  attributedByName?: string;
  logoUrl?: string;
}

export function FeedbackLinkedEmail({
  recipientName,
  postTitle,
  postUrl,
  workspaceName,
  unsubscribeUrl,
  preferencesUrl,
  attributedByName,
  logoUrl,
}: FeedbackLinkedEmailProps) {
  const greeting = recipientName ? `Thanks ${recipientName}!` : "Thanks!";
  const attribution = attributedByName
    ? ` ${attributedByName} from the ${workspaceName} team has linked your feedback to a post.`
    : ` Your feedback has been linked to a post on ${workspaceName}.`;

  return (
    <EmailLayout
      footer={
        <NotificationFooter
          reason="You received this email because your feedback was attributed to this post."
          unsubscribeUrl={unsubscribeUrl}
          preferencesUrl={preferencesUrl}
        />
      }
      preview={`Your feedback has been linked to "${postTitle}"`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      {/* Content */}
      <EmailIntro title="Your feedback is being tracked!" />
      <Text className="k-text-85" style={typography.text}>
        {greeting}
        {attribution} You'll receive updates when the status changes or new
        comments are posted.
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

      {/* CTA Button */}
      <Section
        style={{ textAlign: "start", marginTop: "32px", marginBottom: "32px" }}
      >
        <EmailButton href={postUrl}>View Feedback</EmailButton>
      </Section>

      {/* Footer */}
    </EmailLayout>
  );
}
