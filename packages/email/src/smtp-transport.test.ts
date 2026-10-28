import * as nodemailer from "nodemailer";
import { describe, expect, it } from "vite-plus/test";
import { getSmtpTransportOptions } from "./smtp-config";
import { createPlaintextRelay } from "./test-support/smtp-relay";

describe("SMTP transport encryption", () => {
  it.each([false, true])(
    "only sends credentials and mail to a plaintext relay with explicit opt-out=%s",
    async (allowPlaintext) => {
      const relay = await createPlaintextRelay();
      const transport = nodemailer.createTransport({
        ...getSmtpTransportOptions({
          SMTP_HOST: "127.0.0.1",
          SMTP_PORT: String(relay.port),
          SMTP_SECURE: "false",
          SMTP_USER: "test-user",
          SMTP_PASSWORD: "test-password",
          ...(allowPlaintext ? { SMTP_REQUIRE_TLS: "false" } : {}),
        }),
        connectionTimeout: 1000,
        greetingTimeout: 1000,
        socketTimeout: 1000,
      });
      try {
        const result = transport.sendMail({
          from: "sender@example.test",
          to: "recipient@example.test",
          text: "local test token",
        });
        if (allowPlaintext) {
          await expect(result).resolves.toMatchObject({
            accepted: ["recipient@example.test"],
          });
          expect(relay.commands.some((line) => line.startsWith("AUTH "))).toBe(
            true,
          );
          expect(relay.commands).toContain("DATA");
        } else {
          await expect(result).rejects.toMatchObject({ code: "ETLS" });
          expect(relay.commands).toContain("STARTTLS");
          expect(
            relay.commands.some((line) => /^(AUTH|MAIL|RCPT|DATA)/.test(line)),
          ).toBe(false);
        }
      } finally {
        transport.close();
        await relay.close();
      }
    },
  );
});
