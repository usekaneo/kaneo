/**
 * Subject, intro, and template-gate helpers for conversation emails.
 *
 * Kept next to the senders so the notify path and the package tests share one
 * spelling of "Re: {subject}" and of the first-vs-follow-up team-alert intro.
 */

export type ConversationMailDirection =
  | "agent_reply"
  | "visitor_message"
  | "agent_started";

/** Strip any leading `Re:` tokens (any case, repeated) and prefix a single `Re:`. */
export function conversationReplySubject(
  subject: string | null | undefined,
): string | null {
  if (subject == null) return null;
  const stripped = subject.replace(/^\s*(re:\s*)+/i, "").trim();
  if (!stripped) return null;
  return `Re: ${stripped}`;
}

/** Human correspondence template: email-channel agent replies and agent-started mail. */
export function isHumanReplyTemplate(
  channel: string | undefined,
  direction: ConversationMailDirection,
  correspondence?: boolean,
): boolean {
  const theirs = correspondence ?? channel === "email";
  return (
    theirs && (direction === "agent_reply" || direction === "agent_started")
  );
}

/** `{visitor}: {subject|preview}` for teammate alerts. */
export function teamAlertSubject(
  visitorName: string,
  subject: string | null | undefined,
  preview?: string | null,
): string {
  const topic =
    subject?.replace(/^\s*(re:\s*)+/i, "").trim() ||
    preview?.replace(/\s+/g, " ").trim().slice(0, 80) ||
    "New message";
  return `${visitorName}: ${topic}`;
}

export function agentReplyDisplayName(
  agentName: string,
  workspaceName: string,
): string {
  return `${agentName} (${workspaceName})`;
}

export function conversationMessageCopy(opts: {
  direction: ConversationMailDirection;
  senderName: string;
  workspaceName: string;
  conversationSubject?: string | null;
  /** Team-alert subject fallback when the conversation has no subject. */
  preview?: string | null;
  channel?: string;
  isFirstMessage?: boolean;
  /** When set, overrides the channel string for the human-template gate. */
  correspondence?: boolean;
}): {
  subject: string;
  heading: string;
  intro: string;
  ctaLabel: string;
  reason: string;
  useHumanTemplate: boolean;
} {
  const { direction, senderName, workspaceName } = opts;
  const useHumanTemplate = isHumanReplyTemplate(
    opts.channel,
    direction,
    opts.correspondence,
  );
  const forwarded = conversationReplySubject(opts.conversationSubject);

  if (direction === "visitor_message") {
    const intro =
      opts.isFirstMessage === true
        ? `${senderName} started a conversation in ${workspaceName}.`
        : `${senderName} sent a new message in ${workspaceName}.`;
    return {
      subject: teamAlertSubject(
        senderName,
        opts.conversationSubject,
        opts.preview,
      ),
      heading: "New message",
      intro,
      ctaLabel: "Open inbox",
      reason:
        "You received this email because you are a member of this workspace.",
      useHumanTemplate: false,
    };
  }

  const isReply = direction === "agent_reply";
  const generic = isReply
    ? `New reply from ${workspaceName}`
    : `New message from ${workspaceName}`;
  return {
    subject: forwarded ?? generic,
    heading: forwarded ?? generic,
    intro: isReply
      ? `${senderName} replied to your conversation with ${workspaceName}.`
      : `${senderName} from ${workspaceName} sent you a message.`,
    ctaLabel: "View conversation",
    reason: isReply
      ? "You received this email because you have an open conversation with this team."
      : `You received this email because ${workspaceName} sent you a message.`,
    useHumanTemplate,
  };
}

/** RFC 5322 References / In-Reply-To assembly for a visitor-facing send. */
export function assembleOutboundThreading(input: {
  messageId?: string;
  outboundIds: string[];
  inboundIds: string[];
  mergedIds?: string[];
}): {
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
} {
  if (!input.messageId) return {};
  const inbound = input.inboundIds;
  const outbound = input.outboundIds;
  const merged = input.mergedIds ?? [...inbound, ...outbound];
  const unique = [...new Set(merged.filter((id) => id.length > 0))];
  const inReplyTo =
    inbound[inbound.length - 1] ?? outbound[outbound.length - 1];
  return {
    messageId: input.messageId,
    inReplyTo,
    references: unique.length > 0 ? unique : undefined,
  };
}
