import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import {
  isEmailConfigured,
  getReceivedEmail,
  sendInvitationEmail,
  sendWelcomeEmail,
  sendMagicLinkEmail,
  sendStatusChangeEmail,
  sendNewCommentEmail,
  sendPasswordResetEmail,
  sendRawEmail,
  sendCsatRequestEmail,
} from "../index";
import { sealedTo, sendingAs } from "./brands";

/** Save and restore env vars around each test. */
function withCleanEnv() {
  const saved: Record<string, string | undefined> = {};
  const keys = [
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_PORT",
    "EMAIL_SMTP_USER",
    "EMAIL_SMTP_PASS",
    "EMAIL_SES_ACCESS_KEY_ID",
    "EMAIL_SES_SECRET_ACCESS_KEY",
    "EMAIL_RESEND_API_KEY",
    "RESEND_API_KEY",
    "EMAIL_INBOUND_PROVIDER",
    "EMAIL_FROM",
  ];

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] !== undefined) {
        process.env[key] = saved[key];
      } else {
        delete process.env[key];
      }
    }
  });
}

describe("isEmailConfigured", () => {
  withCleanEnv();

  it("returns false when no email env vars are set", () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it("returns true when SMTP host is set", () => {
    process.env.EMAIL_SMTP_HOST = "smtp.example.com";
    expect(isEmailConfigured()).toBe(true);
  });

  it("returns true when both halves of the SES credential are set", () => {
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    expect(isEmailConfigured()).toBe(true);
  });

  it("returns false for half an SES credential", () => {
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    expect(isEmailConfigured()).toBe(false);
  });

  it("returns true for a Resend key under either name", () => {
    process.env.EMAIL_RESEND_API_KEY = "re_test_123";
    expect(isEmailConfigured()).toBe(true);
    delete process.env.EMAIL_RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_123";
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("getReceivedEmail", () => {
  withCleanEnv();

  it("returns null when no inbound API key is configured (no API call attempted)", async () => {
    await expect(getReceivedEmail("em_x")).resolves.toBeNull();
  });
});

describe("console mode returns { sent: false }", () => {
  withCleanEnv();

  it("sendInvitationEmail returns { sent: false }", async () => {
    const result = await sendInvitationEmail({
      to: sealedTo("test@example.com"),
      invitedByName: "Admin",
      workspaceName: "TestWorkspace",
      inviteLink: "https://example.com/invite",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendWelcomeEmail returns { sent: false }", async () => {
    const result = await sendWelcomeEmail({
      to: sealedTo("test@example.com"),
      name: "Test",
      workspaceName: "TestWorkspace",
      dashboardUrl: "https://example.com/dashboard",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendMagicLinkEmail returns { sent: false }", async () => {
    const result = await sendMagicLinkEmail({
      to: sealedTo("test@example.com"),
      signInUrl: "https://example.com/verify-magic-link?token=abc",
      code: "123456",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendStatusChangeEmail returns { sent: false }", async () => {
    const result = await sendStatusChangeEmail({
      to: sealedTo("test@example.com"),
      postTitle: "Test Post",
      postUrl: "https://example.com/post/1",
      previousStatus: "open",
      newStatus: "in_progress",
      workspaceName: "TestWorkspace",
      unsubscribeUrl: "https://example.com/unsubscribe",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendNewCommentEmail returns { sent: false }", async () => {
    const result = await sendNewCommentEmail({
      to: sealedTo("test@example.com"),
      postTitle: "Test Post",
      postUrl: "https://example.com/post/1",
      commenterName: "Commenter",
      commentPreview: "This is a comment",
      isTeamMember: false,
      workspaceName: "TestWorkspace",
      unsubscribeUrl: "https://example.com/unsubscribe",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendPasswordResetEmail returns { sent: false }", async () => {
    const result = await sendPasswordResetEmail({
      to: sealedTo("test@example.com"),
      resetLink: "https://example.com/auth/reset-password?token=abc",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendCsatRequestEmail returns { sent: false }", async () => {
    const result = await sendCsatRequestEmail({
      to: sealedTo("visitor@example.com"),
      promptText: "How did we do?",
      ratingUrls: [
        "https://example.com/csat?token=abc&rating=1",
        "https://example.com/csat?token=abc&rating=2",
        "https://example.com/csat?token=abc&rating=3",
        "https://example.com/csat?token=abc&rating=4",
        "https://example.com/csat?token=abc&rating=5",
      ],
      workspaceName: "TestWorkspace",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendRawEmail returns { sent: false } (custom From, prerendered html)", async () => {
    const result = await sendRawEmail({
      from: sendingAs("support@acme.com"),
      to: "customer@example.com",
      subject: "Re: your ticket",
      html: "<p>Here is the reply.</p>",
      text: "Here is the reply.",
    });
    expect(result).toEqual({ sent: false, reason: "no_provider" });
  });

  it("sendRawEmail drops a synthetic anonymous recipient", async () => {
    const result = await sendRawEmail({
      from: sendingAs("support@acme.com"),
      to: "temp-abc123@anon.quills.io",
      subject: "x",
      html: "<p>x</p>",
    });
    // Refused for the recipient, not for want of a provider: the guard runs
    // before the ladder, so the reason names the address rather than the config.
    expect(result).toEqual({ sent: false, reason: "anon_recipient" });
  });
});
