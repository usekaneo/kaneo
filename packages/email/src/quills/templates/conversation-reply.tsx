import { EmailLayout } from "./email-layout";
import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { colors } from "./shared-styles";

import React from "react";
void React;
/* oxlint-disable react/no-danger -- Preserve the rich-email contract; callers must supply trusted, sanitized HTML. */
import { Link, Text } from "@react-email/components";

/**
 * The agent's message and signature stay together in the shared conversation frame.
 */
export interface ConversationReplyEmailProps {
  /** Sanitized HTML of the agent's message. */
  bodyHtml?: string;
  /** Plain fallback when there is no rendered body. */
  messagePreview: string;
  agentName: string;
  /** Second signature line: team or workspace name. */
  teamName: string;
  /** Portal or widget deep link; omitted when the visitor has no web surface. */
  viewUrl?: string;
  quotedPrevious?: {
    date: Date | string;
    name: string;
    text: string;
  };
}

const body: React.CSSProperties = {
  color: colors.text,
  fontSize: "15px",
  lineHeight: "1.65",
};

const sigName: React.CSSProperties = {
  color: colors.text,
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "20px 0 0",
};

const sigTeam: React.CSSProperties = {
  color: colors.text,
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 20px",
};

const rule: React.CSSProperties = {
  border: "none",
  borderTop: `1px solid ${colors.border}`,
  margin: "0 0 12px",
};

const footer: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: "12px",
  lineHeight: "1.55",
  margin: "0 0 20px",
};

const footerLink: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: "12px",
  textDecoration: "underline",
};

const quote: React.CSSProperties = {
  color: colors.textLight,
  fontSize: "13px",
  lineHeight: "1.55",
  margin: "0",
};

function formatQuoteDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function quoteExcerpt(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 500) return trimmed;
  return `${trimmed.slice(0, 499).trimEnd()}…`;
}

export function ConversationReplyEmail({
  bodyHtml,
  messagePreview,
  agentName,
  teamName,
  viewUrl,
  quotedPrevious,
}: ConversationReplyEmailProps) {
  const preview = messagePreview.slice(0, 140);
  const quoteDate = quotedPrevious ? formatQuoteDate(quotedPrevious.date) : "";

  return (
    <EmailLayout preview={preview} logoAlt={teamName}>
      <EmailIntro title={`A reply from ${agentName}`} />
      <Frame title={teamName}>
        {bodyHtml ? (
          <div
            className="k-text-85"
            style={body}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <Text className="k-text-85" style={{ ...body, margin: "0 0 13px" }}>
            {messagePreview}
          </Text>
        )}

        <Text className="k-text-85" style={sigName}>
          {agentName}
        </Text>
        <Text className="k-text-85" style={sigTeam}>
          {teamName}
        </Text>

        <hr style={rule} />

        <Text className="k-text-85" style={footer}>
          Reply to this email to continue the conversation
          {viewUrl ? (
            <>
              {" · "}
              <Link className="k-link" href={viewUrl} style={footerLink}>
                View it online
              </Link>
            </>
          ) : null}
        </Text>

        {quotedPrevious ? (
          <Text className="k-text-85" style={quote}>
            On {quoteDate}
            {quoteDate ? ", " : ""}
            {quotedPrevious.name} wrote:
            <br />
            {quoteExcerpt(quotedPrevious.text)}
          </Text>
        ) : null}
      </Frame>
    </EmailLayout>
  );
}
