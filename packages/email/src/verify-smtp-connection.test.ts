import { once } from "node:events";
import { createServer, type Socket } from "node:net";
import { describe, expect, it } from "vite-plus/test";
import { createPlaintextRelay } from "./test-support/smtp-relay";
import { verifySmtpConnection } from "./verify-smtp-connection";

const plaintextEnv = (port: number) => ({
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(port),
  SMTP_FROM: "kaneo@example.test",
  SMTP_SECURE: "false",
  SMTP_REQUIRE_TLS: "false",
});

describe("verifySmtpConnection", () => {
  it("reports a missing host or sender as not configured", async () => {
    await expect(
      verifySmtpConnection(1000, { SMTP_HOST: "smtp.example.test" }),
    ).resolves.toEqual({ status: "not_configured" });
  });

  it("connects to the relay without sending mail", async () => {
    const relay = await createPlaintextRelay();
    try {
      await expect(
        verifySmtpConnection(1000, plaintextEnv(relay.port)),
      ).resolves.toEqual({ status: "ok" });
      expect(
        relay.commands.some((line) => /^(MAIL|RCPT|DATA)/.test(line)),
      ).toBe(false);
    } finally {
      await relay.close();
    }
  });

  it("gives up on a server that never answers within the timeout", async () => {
    const sockets = new Set<Socket>();
    const silent = createServer((socket) => sockets.add(socket));
    silent.listen(0, "127.0.0.1");
    await once(silent, "listening");
    const address = silent.address();
    if (!address || typeof address === "string") throw new Error("No port");
    const started = Date.now();
    try {
      const result = await verifySmtpConnection(
        200,
        plaintextEnv(address.port),
      );
      expect(result).toMatchObject({ status: "failed" });
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      for (const socket of sockets) socket.destroy();
      silent.close();
    }
  });

  it("only reports the error category, never the server's message", async () => {
    const result = await verifySmtpConnection(500, {
      ...plaintextEnv(1),
      SMTP_PASSWORD: "super-secret-password",
      SMTP_USER: "someone",
    });
    expect(result).toMatchObject({ status: "failed" });
    expect(JSON.stringify(result)).not.toContain("super-secret-password");
    expect(Object.keys(result).sort()).toEqual(
      expect.arrayContaining(["code", "status"]),
    );
  });
});
