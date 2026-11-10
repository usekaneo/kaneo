import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ZodError } from "zod";
import { emailInputSchema, rawEmailInputSchema } from "../input";
import { MAX_EMAIL_ATTACHMENT_BYTES } from "../attachment";
import { sendRawEmail, sendMagicLinkEmail } from "../index";
import { sealedTo, sendingAs } from "./brands";

const valid = {
  from: sendingAs("Support <support@example.test>"),
  to: "reader@example.test",
  subject: "Hello",
  html: "<p>Hello</p>",
};

afterEach(() => vi.unstubAllEnvs());

describe("shared email input schemas", () => {
  it("preserves valid threading, attachments, and rendered templates", () => {
    const content = new Uint8Array([1, 2]);
    const input = {
      ...valid,
      react: createElement("p", null, "Hello"),
      messageId: "reply@example.test",
      references: ["parent@example.test"],
      extraHeaders: {
        "List-Unsubscribe": "<https://example.test/unsubscribe>",
      },
      attachments: [
        { filename: "hello.txt", contentType: "text/plain", content },
      ],
    };
    expect(emailInputSchema.parse(input)).toEqual(input);
    expect(rawEmailInputSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    { to: "not-an-address" },
    { subject: "Hello\r\nBcc: other@example.test" },
    { from: "support@example.test\nBcc: other@example.test" },
    { replyTo: "reply@example.test\0" },
    { messageId: "id\r\nInjected: yes" },
    { references: ["id\nInjected: yes"] },
    { extraHeaders: { "Invalid:Name": "value" } },
    { extraHeaders: { "X-Test": "value\r\nInjected: yes" } },
    { react: {} },
    {
      attachments: [
        { filename: "a.txt", contentType: "text/plain", content: "not-bytes" },
      ],
    },
  ])(
    "rejects malformed shared fields before provider selection: %j",
    async (invalid) => {
      // If validation did not run first, conflicting providers would throw instead.
      vi.stubEnv("EMAIL_SMTP_HOST", "localhost");
      vi.stubEnv("EMAIL_RESEND_API_KEY", "test-only");
      expect(() => emailInputSchema.parse({ ...valid, ...invalid })).toThrow(
        ZodError,
      );
      await expect(
        sendRawEmail({ ...valid, ...invalid } as typeof valid),
      ).rejects.toBeInstanceOf(ZodError);
    },
  );

  it("validates branded template sends at the same boundary", async () => {
    await expect(
      sendMagicLinkEmail({
        to: sealedTo("invalid"),
        signInUrl: "https://example.test/sign-in",
        code: "123456",
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("requires raw HTML and enforces the aggregate attachment budget", () => {
    expect(
      rawEmailInputSchema.safeParse({ ...valid, html: undefined }).success,
    ).toBe(false);
    const file = {
      filename: "a.bin",
      contentType: "application/octet-stream",
      content: new Uint8Array(MAX_EMAIL_ATTACHMENT_BYTES),
    };
    expect(
      emailInputSchema.safeParse({ ...valid, attachments: [file] }).success,
    ).toBe(true);
    expect(
      emailInputSchema.safeParse({
        ...valid,
        attachments: [file, { ...file, content: new Uint8Array(1) }],
      }).success,
    ).toBe(false);
  });
});
