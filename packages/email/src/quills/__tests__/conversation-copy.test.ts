import { describe, expect, it } from "vite-plus/test";
import {
  assembleOutboundThreading,
  conversationMessageCopy,
  conversationReplySubject,
  isHumanReplyTemplate,
} from "../conversation-copy";

describe("conversationReplySubject", () => {
  it("prefixes Re: and never doubles it", () => {
    expect(conversationReplySubject("Billing overcharge")).toBe(
      "Re: Billing overcharge",
    );
    expect(conversationReplySubject("Re: Billing overcharge")).toBe(
      "Re: Billing overcharge",
    );
    expect(conversationReplySubject("RE: re: Billing overcharge")).toBe(
      "Re: Billing overcharge",
    );
    expect(conversationReplySubject("  re:   Invoice  ")).toBe("Re: Invoice");
  });

  it("returns null when there is no usable subject", () => {
    expect(conversationReplySubject(null)).toBeNull();
    expect(conversationReplySubject(undefined)).toBeNull();
    expect(conversationReplySubject("")).toBeNull();
    expect(conversationReplySubject("Re:")).toBeNull();
    expect(conversationReplySubject("   ")).toBeNull();
  });
});

describe("isHumanReplyTemplate", () => {
  it("is true only for email-channel agent correspondence", () => {
    expect(isHumanReplyTemplate("email", "agent_reply")).toBe(true);
    expect(isHumanReplyTemplate("email", "agent_started")).toBe(true);
    expect(isHumanReplyTemplate("email", "visitor_message")).toBe(false);
    expect(isHumanReplyTemplate("messenger", "agent_reply")).toBe(false);
    expect(isHumanReplyTemplate(undefined, "agent_reply")).toBe(false);
  });
});

describe("conversationMessageCopy", () => {
  it("uses Re: {subject} for visitor-facing replies when a subject is stored", () => {
    const copy = conversationMessageCopy({
      direction: "agent_reply",
      senderName: "Alex",
      workspaceName: "Acme",
      conversationSubject: "Re: Billing overcharge",
      channel: "email",
    });
    expect(copy.subject).toBe("Re: Billing overcharge");
    expect(copy.useHumanTemplate).toBe(true);
  });

  it("keeps the generic heading on messenger when there is no subject", () => {
    const copy = conversationMessageCopy({
      direction: "agent_reply",
      senderName: "Alex",
      workspaceName: "Acme",
      channel: "messenger",
    });
    expect(copy.subject).toBe("New reply from Acme");
    expect(copy.heading).toBe("New reply from Acme");
    expect(copy.useHumanTemplate).toBe(false);
  });

  it("forwards the subject onto the messenger card heading", () => {
    const copy = conversationMessageCopy({
      direction: "agent_reply",
      senderName: "Alex",
      workspaceName: "Acme",
      conversationSubject: "Widget offline",
      channel: "messenger",
    });
    expect(copy.heading).toBe("Re: Widget offline");
    expect(copy.useHumanTemplate).toBe(false);
  });

  it("distinguishes first team-alert copy from a follow-up", () => {
    const first = conversationMessageCopy({
      direction: "visitor_message",
      senderName: "Priya",
      workspaceName: "Acme",
      isFirstMessage: true,
    });
    const follow = conversationMessageCopy({
      direction: "visitor_message",
      senderName: "Priya",
      workspaceName: "Acme",
      isFirstMessage: false,
    });
    expect(first.intro).toBe("Priya started a conversation in Acme.");
    expect(follow.intro).toBe("Priya sent a new message in Acme.");
    expect(follow.useHumanTemplate).toBe(false);
    expect(first.subject).toBe("Priya: New message");
  });

  it("forwards the visitor name and subject on team alerts", () => {
    const copy = conversationMessageCopy({
      direction: "visitor_message",
      senderName: "Priya",
      workspaceName: "Acme",
      conversationSubject: "Re: Billing overcharge",
      preview: "The invoice looks wrong",
    });
    expect(copy.subject).toBe("Priya: Billing overcharge");
  });

  it("falls back to the preview when the conversation has no subject", () => {
    const copy = conversationMessageCopy({
      direction: "visitor_message",
      senderName: "Priya",
      workspaceName: "Acme",
      preview: "The invoice looks wrong",
    });
    expect(copy.subject).toBe("Priya: The invoice looks wrong");
  });
});

describe("assembleOutboundThreading", () => {
  it("sets In-Reply-To to the latest inbound id when one exists", () => {
    const headers = assembleOutboundThreading({
      messageId: "ours-new@x",
      outboundIds: ["ours-1@x", "ours-2@x"],
      inboundIds: ["cust-1@x", "cust-2@x"],
    });
    expect(headers.inReplyTo).toBe("cust-2@x");
    expect(headers.references).toEqual([
      "cust-1@x",
      "cust-2@x",
      "ours-1@x",
      "ours-2@x",
    ]);
  });

  it("falls back to the latest outbound id when there is no inbound Message-ID", () => {
    const headers = assembleOutboundThreading({
      messageId: "ours-new@x",
      outboundIds: ["ours-1@x", "ours-2@x"],
      inboundIds: [],
    });
    expect(headers.inReplyTo).toBe("ours-2@x");
    expect(headers.references).toEqual(["ours-1@x", "ours-2@x"]);
  });

  it("omits parent headers when nothing precedes this mail", () => {
    const headers = assembleOutboundThreading({
      messageId: "ours-new@x",
      outboundIds: [],
      inboundIds: [],
    });
    expect(headers.inReplyTo).toBeUndefined();
    expect(headers.references).toBeUndefined();
  });

  it("returns empty when no Message-ID can be minted", () => {
    expect(
      assembleOutboundThreading({
        outboundIds: ["ours-1@x"],
        inboundIds: ["cust-1@x"],
      }),
    ).toEqual({});
  });
});
