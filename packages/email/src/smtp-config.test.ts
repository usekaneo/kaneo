import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { getSmtpTransportOptions, isSmtpConfigured } from "./smtp-config";

describe("getSmtpTransportOptions", () => {
  it("omits auth when no credentials are configured", () => {
    const options = getSmtpTransportOptions({
      SMTP_HOST: "relay.internal",
      SMTP_PORT: "25",
      SMTP_SECURE: "false",
    });

    expect(options.auth).toBeUndefined();
    expect("auth" in options).toBe(false);
    expect(options.host).toBe("relay.internal");
    expect(options.port).toBe(25);
    expect(options.secure).toBe(false);
  });

  it("omits auth when only one credential is configured", () => {
    expect(
      getSmtpTransportOptions({ SMTP_HOST: "relay.internal", SMTP_USER: "me" })
        .auth,
    ).toBeUndefined();
    expect(
      getSmtpTransportOptions({
        SMTP_HOST: "relay.internal",
        SMTP_PASSWORD: "s",
      }).auth,
    ).toBeUndefined();
  });

  it("includes auth when both credentials are configured", () => {
    const options = getSmtpTransportOptions({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_USER: "me",
      SMTP_PASSWORD: "secret",
    });

    expect(options.auth).toEqual({ user: "me", pass: "secret" });
  });

  it("leaves the port unset instead of NaN when SMTP_PORT is missing", () => {
    const options = getSmtpTransportOptions({ SMTP_HOST: "relay.internal" });

    expect(options.port).toBeUndefined();
  });

  it("defaults to encrypted delivery and keeps certificate validation enabled", () => {
    expect(getSmtpTransportOptions({ SMTP_HOST: "h" }).secure).toBe(true);
    const options = getSmtpTransportOptions({ SMTP_SECURE: "false" });
    expect(options.requireTLS).toBe(true);
    expect(options.ignoreTLS).toBe(false);
    expect(options.tls?.rejectUnauthorized).not.toBe(false);
  });

  it("rejects the formerly misleading flag instead of disabling STARTTLS", () => {
    for (const secure of ["true", "false"]) {
      expect(() =>
        getSmtpTransportOptions({
          SMTP_SECURE: secure,
          SMTP_IGNORE_TLS: "true",
        }),
      ).toThrow("SMTP_IGNORE_TLS=true is no longer supported");
    }
  });

  it("requires an explicit opt-out for relays without TLS", () => {
    const options = getSmtpTransportOptions({
      SMTP_SECURE: "false",
      SMTP_REQUIRE_TLS: "false",
      SMTP_IGNORE_TLS: "false",
    });
    expect(options.requireTLS).toBe(false);
    expect(options.ignoreTLS).toBe(false);
  });
});

describe("SMTP_PASSWORD_FILE", () => {
  it("reads the password from a file and prefers SMTP_PASSWORD", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "kaneo-smtp-"));
    try {
      const file = path.join(directory, "smtp-password");
      writeFileSync(file, "file-secret\n");
      const env = {
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "me",
        SMTP_PASSWORD_FILE: file,
      };

      expect(getSmtpTransportOptions(env).auth).toEqual({
        user: "me",
        pass: "file-secret",
      });
      expect(
        getSmtpTransportOptions({ ...env, SMTP_PASSWORD: "direct" }).auth,
      ).toEqual({ user: "me", pass: "direct" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails loudly when the file is missing or empty", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "kaneo-smtp-"));
    try {
      const empty = path.join(directory, "empty");
      writeFileSync(empty, "\n");
      const env = { SMTP_HOST: "smtp.example.com", SMTP_USER: "me" };

      expect(() =>
        getSmtpTransportOptions({
          ...env,
          SMTP_PASSWORD_FILE: path.join(directory, "missing"),
        }),
      ).toThrow("SMTP_PASSWORD_FILE could not be read (ENOENT)");
      expect(() =>
        getSmtpTransportOptions({ ...env, SMTP_PASSWORD_FILE: empty }),
      ).toThrow("SMTP_PASSWORD_FILE points to an empty file");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("isSmtpConfigured", () => {
  it("is true for a relay that needs no credentials", () => {
    expect(
      isSmtpConfigured({
        SMTP_HOST: "relay.internal",
        SMTP_FROM: "kaneo@example.com",
      }),
    ).toBe(true);
  });

  it("is false without a host or a sender", () => {
    expect(isSmtpConfigured({ SMTP_FROM: "kaneo@example.com" })).toBe(false);
    expect(isSmtpConfigured({ SMTP_HOST: "relay.internal" })).toBe(false);
    expect(isSmtpConfigured({})).toBe(false);
  });
});
