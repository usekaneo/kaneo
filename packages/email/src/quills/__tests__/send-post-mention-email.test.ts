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

import { sendPostMentionEmail } from "../index";

const ENV_KEYS = [
  "EMAIL_SMTP_HOST",
  "EMAIL_SMTP_PORT",
  "EMAIL_SMTP_USER",
  "EMAIL_SMTP_PASS",
  "EMAIL_SES_ACCESS_KEY_ID",
  "EMAIL_SES_SECRET_ACCESS_KEY",
  "EMAIL_FROM",
];

describe("sendPostMentionEmail", () => {
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

  it("renders subject + html and forwards to the transport", async () => {
    const result = await sendPostMentionEmail({
      to: "user@example.com",
      mentionerName: "Alex",
      postTitle: "Why we should add dark mode",
      excerpt: "Hey, take a look at this proposal.",
      postUrl: "https://example.com/p/123",
      workspaceName: "Acme",
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(result).toEqual({ sent: true });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
      from: string;
    };
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toBe(
      'Alex mentioned you in "Why we should add dark mode"',
    );
    expect(call.html).toContain("Hey, take a look at this proposal.");
    expect(call.html).toContain("Alex");
  });

  it('falls back to "Anonymous user" in the subject when mentionerName is empty', async () => {
    await sendPostMentionEmail({
      to: "user@example.com",
      mentionerName: "",
      postTitle: "Dark mode",
      excerpt: "",
      postUrl: "https://example.com/p/1",
      workspaceName: "Acme",
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0] as { subject: string };
    expect(call.subject).toBe('Anonymous user mentioned you in "Dark mode"');
  });
});
