import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";

// Mock nodemailer so we can capture sendMail invocations without opening a real SMTP socket.
const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-msg-id" });
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: sendMailMock }),
  },
}));

import { sendNoteMentionEmail } from "../index";

const ENV_KEYS = [
  "EMAIL_SMTP_HOST",
  "EMAIL_SMTP_PORT",
  "EMAIL_SMTP_USER",
  "EMAIL_SMTP_PASS",
  "EMAIL_SES_ACCESS_KEY_ID",
  "EMAIL_SES_SECRET_ACCESS_KEY",
  "EMAIL_FROM",
];

describe("sendNoteMentionEmail", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    // Force SMTP provider so the helper renders + calls sendMail.
    process.env.EMAIL_SMTP_HOST = "smtp.example.com";
    process.env.EMAIL_FROM = "noreply@example.com";
    sendMailMock.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] !== undefined) {
        process.env[key] = saved[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("renders the author, note preview and inbox link", async () => {
    const result = await sendNoteMentionEmail({
      to: "agent@example.com",
      authorName: "Jane",
      preview: "can you take a look at the refund policy here?",
      conversationUrl: "https://w.example/admin/inbox?i=conversation_1",
      workspaceName: "Acme Support",
      preferencesUrl: "https://w.example/settings/preferences",
    });

    expect(result).toEqual({ sent: true });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(call.to).toBe("agent@example.com");
    expect(call.subject).toBe("Jane mentioned you in an internal note");
    expect(call.html).toContain(
      "can you take a look at the refund policy here?",
    );
    expect(call.html).toContain(
      "https://w.example/admin/inbox?i=conversation_1",
    );
    // The only opt-out on an agent-facing alert is the preferences surface.
    expect(call.html).toContain("https://w.example/settings/preferences");
    expect(call.html).not.toContain("/unsubscribe");
  });

  it("stamps the RFC 5322 threading headers so repeat alerts collapse into one thread", async () => {
    await sendNoteMentionEmail({
      to: "agent@example.com",
      authorName: "Jane",
      preview: "can you take a look?",
      conversationUrl: "https://w.example/admin/inbox?i=conversation_1",
      workspaceName: "Acme Support",
      messageId: "note.abc.nonce@example.com",
      inReplyTo: "note.abc@example.com",
      references: ["note.abc@example.com"],
    });

    const call = sendMailMock.mock.calls[0][0] as {
      messageId?: string;
      inReplyTo?: string;
      references?: string;
    };
    expect(call.messageId).toBe("<note.abc.nonce@example.com>");
    expect(call.inReplyTo).toBe("<note.abc@example.com>");
    expect(call.references).toBe("<note.abc@example.com>");
  });

  it("sends without threading headers when no ids are supplied", async () => {
    await sendNoteMentionEmail({
      to: "agent@example.com",
      authorName: "Jane",
      preview: "can you take a look?",
      conversationUrl: "https://w.example/admin/inbox?i=conversation_1",
      workspaceName: "Acme Support",
    });

    const call = sendMailMock.mock.calls[0][0] as {
      messageId?: string;
      inReplyTo?: string;
      references?: string;
    };
    expect(call.messageId).toBeUndefined();
    expect(call.inReplyTo).toBeUndefined();
    expect(call.references).toBeUndefined();
  });

  it("sends without a quote block when the note carries no preview text", async () => {
    await sendNoteMentionEmail({
      to: "agent@example.com",
      authorName: "",
      preview: "",
      conversationUrl: "https://w.example/admin/inbox?i=conversation_1",
      workspaceName: "Acme Support",
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0] as {
      subject: string;
      html: string;
    };
    expect(call.subject).toBe("A teammate mentioned you in an internal note");
    expect(call.html).toContain("Open conversation");
  });
});
