import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";
import {
  getEmailProvider,
  sendChangelogPublishedEmail,
  sendRawEmail,
  sendStatusChangeEmail,
} from "../index";
import { ResendEmailError } from "../resend";
import { withEmailIdempotencyKey } from "../idempotency";
import { sendingAs } from "./brands";

/**
 * The Resend rung, offline. The SDK class is replaced by one whose `send`
 * records the payload it is handed, so every assertion reads what would have
 * gone over the wire.
 */

const resendSend = vi.hoisted(() => vi.fn());
const resendKeys = vi.hoisted(() => [] as Array<string | undefined>);

vi.mock("resend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("resend")>();
  return {
    ...actual,
    Resend: class {
      emails = { send: resendSend };
      constructor(key?: string) {
        resendKeys.push(key);
      }
    },
  };
});

const ENV_KEYS = [
  "EMAIL_SES_ACCESS_KEY_ID",
  "EMAIL_SES_SECRET_ACCESS_KEY",
  "EMAIL_SMTP_HOST",
  "EMAIL_RESEND_API_KEY",
  "RESEND_API_KEY",
  "EMAIL_INBOUND_PROVIDER",
  "EMAIL_FROM",
] as const;

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resendSend.mockReset();
  resendSend.mockResolvedValue({
    data: { id: "resend-email-id" },
    error: null,
    headers: null,
  });
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] !== undefined) process.env[key] = saved[key];
    else delete process.env[key];
  }
});

describe("resend sending", () => {
  it("is the active provider when only a Resend key is set", () => {
    process.env.RESEND_API_KEY = "re_alias";
    expect(getEmailProvider()).toBe("resend");
  });

  it("builds the request from every part of the message", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    const result = await sendRawEmail({
      from: sendingAs("Support <support@acme.test>"),
      to: "visitor@example.test",
      subject: "Re: hello",
      html: "<p>hi</p>",
      text: "hi",
      replyTo: "reply+abc@in.acme.test",
      messageId: "minted@acme.test",
      inReplyTo: "theirs@example.test",
      references: ["first@example.test", "theirs@example.test"],
      extraHeaders: { "Auto-Submitted": "auto-replied" },
      attachments: [
        {
          filename: "notes.txt",
          contentType: "text/plain",
          content: new TextEncoder().encode("file body"),
        },
      ],
    });

    expect(resendSend).toHaveBeenCalledTimes(1);
    const payload = resendSend.mock.calls[0][0];
    expect(payload).toMatchObject({
      from: "Support <support@acme.test>",
      to: "visitor@example.test",
      subject: "Re: hello",
      html: "<p>hi</p>",
      text: "hi",
      replyTo: "reply+abc@in.acme.test",
      headers: {
        "Auto-Submitted": "auto-replied",
        "In-Reply-To": "<theirs@example.test>",
        References: "<first@example.test> <theirs@example.test>",
      },
    });
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toBe("notes.txt");
    expect(payload.attachments[0].contentType).toBe("text/plain");
    expect(Buffer.isBuffer(payload.attachments[0].content)).toBe(true);
    expect(payload.attachments[0].content.toString("utf8")).toBe("file body");
    // Resend assigns the wire Message-ID itself, so ours is not sent and the
    // result says the id is the transport's and undisclosed: nothing records
    // the minted id as one a reply could quote.
    expect(payload.headers).not.toHaveProperty("Message-ID");
    expect(result).toEqual({ sent: true, messageId: null });
    expect(resendKeys.at(-1)).toBe("re_test");
  });

  it("omits optional parts that were not given", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    await sendRawEmail({
      from: sendingAs("a@acme.test"),
      to: "c@example.test",
      subject: "s",
      html: "<p>x</p>",
    });
    const payload = resendSend.mock.calls[0][0];
    // Outside an idempotency scope there is no key to send.
    expect(resendSend.mock.calls[0][1]?.idempotencyKey).toBeUndefined();
    expect(payload).not.toHaveProperty("replyTo");
    expect(payload).not.toHaveProperty("headers");
    expect(payload).not.toHaveProperty("attachments");
  });

  it("renders branded templates to html and text from EMAIL_FROM", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Acme <noreply@acme.test>";
    await sendStatusChangeEmail({
      to: "c@example.test",
      postTitle: "Dark mode",
      postUrl: "https://x.test/p/1",
      previousStatus: "open",
      newStatus: "closed",
      workspaceName: "Acme",
      unsubscribeUrl: "https://x.test/u",
    });
    const payload = resendSend.mock.calls[0][0];
    expect(payload.from).toBe("Acme <noreply@acme.test>");
    expect(payload.html).toMatch(/Dark mode/);
    expect(payload.text).toMatch(/Dark mode/);
    expect(payload).not.toHaveProperty("react");
  });

  it("carries RFC 8058 one-click unsubscribe headers on a changelog email", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Acme <noreply@acme.test>";
    await sendChangelogPublishedEmail({
      to: "c@example.test",
      changelogTitle: "May release",
      changelogUrl: "https://x.test/changelog/1",
      contentPreview: "New things",
      workspaceName: "Acme",
      unsubscribeUrl: "https://x.test/unsubscribe?token=tok-1",
    });
    const payload = resendSend.mock.calls[0][0];
    expect(payload.headers).toEqual({
      "List-Unsubscribe": "<https://x.test/unsubscribe?token=tok-1>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("sends one idempotency key for every attempt of one send, and a new one per send", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    const send = () =>
      sendRawEmail({
        from: sendingAs("a@acme.test"),
        to: "c@example.test",
        subject: "s",
        html: "<p>x</p>",
      });
    resendSend.mockResolvedValueOnce({
      data: null,
      error: {
        name: "internal_server_error",
        message: "later",
        statusCode: 500,
      },
      headers: null,
    });
    // One logical send, retried inside its scope as a caller's retry loop does.
    await withEmailIdempotencyKey("send-1", async () => {
      await send().catch(() => undefined);
      await send();
    });
    await withEmailIdempotencyKey("send-2", send);

    const keys = resendSend.mock.calls.map((call) => call[1]?.idempotencyKey);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(/^qb-[0-9a-f]{64}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toMatch(/^qb-[0-9a-f]{64}$/);
    expect(keys[2]).not.toBe(keys[0]);
    // The raw scope value never reaches the provider.
    expect(keys[0]).not.toContain("send-1");
  });

  it("retries a concurrent request on the same key rather than failing it", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    resendSend.mockResolvedValueOnce({
      data: null,
      error: {
        name: "concurrent_idempotent_requests",
        message: "in flight",
        statusCode: 409,
      },
      headers: null,
    });
    await expect(
      sendRawEmail({
        from: sendingAs("a@acme.test"),
        to: "c@example.test",
        subject: "s",
        html: "<p>x</p>",
      }),
    ).rejects.toMatchObject({ retryable: true, status: 409 });
  });

  it("throws a permanent error for a rejected message", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    resendSend.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "bad from", statusCode: 422 },
      headers: null,
    });
    const send = sendRawEmail({
      from: sendingAs("a@acme.test"),
      to: "c@example.test",
      subject: "s",
      html: "<p>x</p>",
    });
    await expect(send).rejects.toBeInstanceOf(ResendEmailError);
    await expect(send).rejects.toMatchObject({
      retryable: false,
      status: 422,
      code: "validation_error",
    });
  });

  it("throws a retryable error for a rate limit or an outage", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    for (const [status, name] of [
      [429, "rate_limit_exceeded"],
      [500, "internal_server_error"],
      [null, "application_error"],
    ] as const) {
      resendSend.mockResolvedValueOnce({
        data: null,
        error: { name, message: "later", statusCode: status },
        headers: null,
      });
      await expect(
        sendRawEmail({
          from: sendingAs("a@acme.test"),
          to: "c@example.test",
          subject: "s",
          html: "<p>x</p>",
        }),
      ).rejects.toMatchObject({ retryable: true });
    }
  });

  it("does not send through Resend when the key is kept for inbound only", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    process.env.EMAIL_INBOUND_PROVIDER = "resend";
    expect(getEmailProvider()).toBe("ses");
  });

  it("refuses to pick a provider when two are configured", async () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    process.env.EMAIL_SMTP_HOST = "smtp.acme.test";
    await expect(
      sendRawEmail({
        from: sendingAs("a@acme.test"),
        to: "c@example.test",
        subject: "s",
        html: "<p>x</p>",
      }),
    ).rejects.toMatchObject({
      name: "EmailProviderConflictError",
      retryable: false,
    });
    expect(resendSend).not.toHaveBeenCalled();
  });
});
