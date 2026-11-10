import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
import { Heading, Section, Text } from "@react-email/components";
import { EmailLayout, NotificationFooter } from "./email-layout";
import { typography } from "./shared-styles";

interface StatusChangeEmailProps {
  postTitle: string;
  postUrl: string;
  previousStatus: string;
  newStatus: string;
  organizationName: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

function capitalizeStatus(status: string): string {
  return status
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function StatusChangeEmail({
  postTitle,
  postUrl,
  previousStatus,
  newStatus,
  organizationName,
  unsubscribeUrl,
  preferencesUrl,
  logoUrl,
}: StatusChangeEmailProps) {
  const formattedNewStatus = capitalizeStatus(newStatus);
  const formattedPreviousStatus = capitalizeStatus(previousStatus);

  return (
    <EmailLayout
      footer={
        <NotificationFooter
          reason="You received this email because you submitted or subscribed to this feedback."
          unsubscribeUrl={unsubscribeUrl}
          preferencesUrl={preferencesUrl}
        />
      }
      preview={`Your feedback is now ${formattedNewStatus}`}
      logoUrl={logoUrl}
      logoAlt={organizationName}
    >
      {/* Content */}
      <Heading className="k-text" style={typography.h1}>
        Your feedback is now {formattedNewStatus}!
      </Heading>
      <Text className="k-text-85" style={typography.text}>
        Great news! The status of your feedback has been updated on{" "}
        {organizationName}.
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

      {/* Status Change */}
      <Text className="k-text-85" style={typography.text}>
        {formattedPreviousStatus}
        {" \u2192 "}
        <strong>{formattedNewStatus}</strong>
      </Text>

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
