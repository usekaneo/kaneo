import { EmailLayout } from "./email-layout";
import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { colors } from "./shared-styles";

import React from "react";
void React;
import { Text } from "@react-email/components";

export interface ConversationClosedEmailProps {
  workspaceName: string;
  variant: "closed" | "auto_closed";
  viewUrl?: string;
  csatPrompt?: string;
  ratingUrls?: readonly [string, string, string, string, string];
}

const CSAT_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;

const muted: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: "13px",
  lineHeight: "1.55",
};

export function ConversationClosedEmail({
  workspaceName,
  variant,
  viewUrl,
  csatPrompt,
  ratingUrls,
}: ConversationClosedEmailProps) {
  const intro =
    variant === "auto_closed"
      ? "This conversation was closed because we haven't heard back from you."
      : `${workspaceName} marked this conversation as resolved.`;
  const followUp =
    variant === "auto_closed"
      ? "Need anything else? Just reply to this email and the conversation will reopen."
      : "Not sorted? Just reply to this email and the conversation will reopen.";

  return (
    <EmailLayout preview={intro} logoAlt={workspaceName}>
      <EmailIntro title="Conversation resolved" />
      <Frame title={workspaceName}>
        <Text
          className="k-text-85"
          style={{
            margin: "0 0 13px",
            color: colors.text,
            fontSize: "15px",
            lineHeight: "1.65",
          }}
        >
          {intro}
        </Text>
        {ratingUrls ? (
          <>
            <Text
              className="k-text-85"
              style={{
                margin: "20px 0 8px",
                color: colors.text,
                fontSize: "15px",
              }}
            >
              {csatPrompt || "How did we do?"}
            </Text>
            <Text
              className="k-text-85"
              style={{
                margin: "0 0 16px",
                fontSize: "28px",
                letterSpacing: "8px",
              }}
            >
              {CSAT_FACES.map((face, i) => (
                <a
                  key={face}
                  href={ratingUrls[i]}
                  style={{ textDecoration: "none" }}
                >
                  {face}
                </a>
              ))}
            </Text>
          </>
        ) : null}
        <Text className="k-text-85" style={muted}>
          {followUp}
        </Text>
        {viewUrl ? (
          <Text className="k-text-85" style={muted}>
            <a href={viewUrl} style={{ color: colors.textMuted }}>
              View it online
            </a>
          </Text>
        ) : null}
      </Frame>
    </EmailLayout>
  );
}
