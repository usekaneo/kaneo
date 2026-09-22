import { once } from "node:events";
import { createServer, type Socket } from "node:net";
import * as nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";
import { getSmtpTransportOptions } from "./smtp-config";

// A loopback-only SMTP sink: never forwards mail or connects to a real provider.
async function createPlaintextRelay() {
  const commands: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost test relay\r\n");
    let pending = "";
    let inData = false;
    socket.on("data", (chunk) => {
      pending += chunk.toString();
      let end = pending.indexOf("\r\n");
      while (end >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 accepted\r\n");
          }
        } else {
          commands.push(line);
          if (line.startsWith("EHLO")) {
            socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
          } else if (line === "STARTTLS") {
            socket.write("502 TLS unavailable\r\n");
          } else if (line.startsWith("AUTH")) {
            socket.write("235 authenticated\r\n");
          } else if (line === "DATA") {
            inData = true;
            socket.write("354 start mail\r\n");
          } else if (line === "QUIT") {
            socket.end("221 bye\r\n");
          } else {
            socket.write("250 OK\r\n");
          }
        }
        end = pending.indexOf("\r\n");
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No relay port");
  return {
    commands,
    port: address.port,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

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
