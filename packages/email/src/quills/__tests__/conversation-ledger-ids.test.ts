import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  sendConversationAutoAckEmail,
  sendConversationClosedEmail,
  sendConversationMessageEmail,
  sendCsatRequestEmail,
  setEmailLogSink,
  type EmailLogSinkEntry,
} from "../index";

describe("conversation send sites stamp conversationId on the outbound ledger", () => {
  const conversationId = "conversation_1";
  let entries: EmailLogSinkEntry[];

  beforeEach(() => {
    entries = [];
    setEmailLogSink((entry) => {
      entries.push(entry);
    });
    for (const key of [
      "EMAIL_SMTP_HOST",
      "EMAIL_SMTP_PORT",
      "EMAIL_SMTP_USER",
      "EMAIL_SMTP_PASS",
      "EMAIL_SES_ACCESS_KEY_ID",
      "EMAIL_SES_SECRET_ACCESS_KEY",
      "EMAIL_FROM",
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    setEmailLogSink(null);
  });

  it("records conversationId on a team-alert / visitor-message send", async () => {
    await sendConversationMessageEmail({
      to: "agent@example.com",
      direction: "visitor_message",
      senderName: "Priya",
      messagePreview: "Need help",
      ctaUrl: "https://acme.example.com/admin/inbox?i=conversation_1",
      workspaceName: "Acme",
      conversationId,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      conversationId,
      emailType: "ConversationMessageEmail",
      status: "skipped",
    });
  });

  it("records conversationId on a close mail send", async () => {
    await sendConversationClosedEmail({
      to: "priya@example.com",
      workspaceName: "Acme",
      variant: "closed",
      conversationId,
    });
    expect(entries[0]).toMatchObject({
      conversationId,
      emailType: "ConversationClosedEmail",
      status: "skipped",
    });
  });

  it("records conversationId on a cold-inbound auto-ack send", async () => {
    await sendConversationAutoAckEmail({
      to: "priya@example.com",
      workspaceName: "Acme",
      conversationId,
    });
    expect(entries[0]).toMatchObject({
      conversationId,
      emailType: "ConversationAutoAckEmail",
      status: "skipped",
    });
  });

  it("records conversationId on a CSAT request send", async () => {
    await sendCsatRequestEmail({
      to: "priya@example.com",
      promptText: "How did we do?",
      ratingUrls: [
        "https://acme.example.com/csat?rating=1",
        "https://acme.example.com/csat?rating=2",
        "https://acme.example.com/csat?rating=3",
        "https://acme.example.com/csat?rating=4",
        "https://acme.example.com/csat?rating=5",
      ],
      workspaceName: "Acme",
      conversationId,
    });
    expect(entries[0]).toMatchObject({
      conversationId,
      emailType: "CsatRequestEmail",
      status: "skipped",
    });
  });
});
