import { describe, expect, it } from "vitest";
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

  it("defaults to a secure connection and honours the TLS flags", () => {
    expect(getSmtpTransportOptions({ SMTP_HOST: "h" }).secure).toBe(true);
    expect(
      getSmtpTransportOptions({ SMTP_HOST: "h", SMTP_REQUIRE_TLS: "true" })
        .requireTLS,
    ).toBe(true);
    expect(
      getSmtpTransportOptions({ SMTP_HOST: "h", SMTP_IGNORE_TLS: "true" })
        .ignoreTLS,
    ).toBe(true);
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
