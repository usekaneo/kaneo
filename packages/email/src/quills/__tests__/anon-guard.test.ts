import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";
import { ANON_EMAIL_DOMAIN } from "../anon";

// Spy on the SES transport so we can assert whether a real network send was
// attempted. Hoisted so it's available inside the vi.mock factory below.
const { sendSpy } = vi.hoisted(() => ({ sendSpy: vi.fn() }));

vi.mock("@aws-sdk/client-sesv2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-sesv2")>();
  return {
    ...actual,
    SESv2Client: class {
      send = sendSpy;
    },
  };
});

import { sendMagicLinkEmail } from "../index";
import { sealedTo } from "./brands";

/**
 * The synthetic anonymous placeholder domain (temp-<id>@anon.quills.io) is
 * never deliverable. Even with a provider fully configured, the email transport
 * must refuse to deliver there — a last line of defense if a caller forgets to
 * sanitize via realEmail().
 */
describe("sendEmail anon-domain delivery guard", () => {
  const keys = [
    "EMAIL_SMTP_HOST",
    "EMAIL_SES_ACCESS_KEY_ID",
    "EMAIL_SES_SECRET_ACCESS_KEY",
    "EMAIL_SES_REGION",
    "EMAIL_FROM",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    // Fully configure the SES provider so a send WOULD go out if not guarded.
    // The region is part of "fully": without one the transport refuses before
    // it builds a request, which would pass this test for the wrong reason.
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    process.env.EMAIL_SES_REGION = "us-east-1";
    process.env.EMAIL_FROM = "noreply@example.com";
    sendSpy.mockReset();
    sendSpy.mockResolvedValue({
      MessageId: "test_id",
      $metadata: { httpStatusCode: 200 },
    });
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] !== undefined) process.env[key] = saved[key];
      else delete process.env[key];
    }
  });

  it("is reserved for synthetic anonymous placeholders", () => {
    expect(ANON_EMAIL_DOMAIN).toBe("anon.quills.io");
  });

  it("does not deliver to a synthetic anonymous address", async () => {
    const result = await sendMagicLinkEmail({
      to: sealedTo(
        `temp-ni7j5mnendrdtsjwbesk4mubz4jzszhj@${ANON_EMAIL_DOMAIN}`,
      ),
      signInUrl: "https://example.com/verify-magic-link?token=abc",
      code: "123456",
    });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, reason: "anon_recipient" });
  });

  it("matches the anon domain case-insensitively", async () => {
    const result = await sendMagicLinkEmail({
      to: sealedTo("temp-abc@ANON.QUILLS.IO"),
      signInUrl: "https://example.com/verify-magic-link?token=abc",
      code: "123456",
    });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, reason: "anon_recipient" });
  });

  it("still delivers to a real address (guard is domain-specific)", async () => {
    const result = await sendMagicLinkEmail({
      to: sealedTo("jane@example.com"),
      signInUrl: "https://example.com/verify-magic-link?token=abc",
      code: "123456",
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    // The id comes back exactly as the API reported it.
    expect(result).toEqual({ sent: true, messageId: "test_id" });
  });
});
