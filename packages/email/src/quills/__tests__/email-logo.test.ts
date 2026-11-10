import { describe, it, expect, vi } from "vite-plus/test";
import { render } from "@react-email/components";
import { emailAsset } from "../../components/assets";
import { WelcomeEmail } from "../templates/welcome";
import { InvitationEmail } from "../templates/invitation";
import { MagicLinkEmail } from "../templates/magic-link";
import { PasswordResetEmail } from "../templates/password-reset";
import { StatusChangeEmail } from "../templates/status-change";
import { NewCommentEmail } from "../templates/new-comment";
import { ChangelogPublishedEmail } from "../templates/changelog-published";
import { FeedbackLinkedEmail } from "../templates/feedback-linked";

const BRAND_LOGO = "https://example.com/api/storage/logos/brand-logo.png";

describe("email templates use brand logo when provided", () => {
  it("WelcomeEmail renders brand logo", async () => {
    const html = await render(
      WelcomeEmail({
        name: "Alice",
        workspaceName: "Acme",
        dashboardUrl: "https://example.com/dashboard",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
    expect(html).toContain('alt="Acme"');
  });

  it("InvitationEmail renders brand logo", async () => {
    const html = await render(
      InvitationEmail({
        invitedByName: "Bob",
        organizationName: "Acme",
        inviteLink: "https://example.com/invite",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
    expect(html).toContain('alt="Acme"');
  });

  it("MagicLinkEmail renders brand logo", async () => {
    const html = await render(
      MagicLinkEmail({
        signInUrl: "https://example.com/verify-magic-link?token=abc",
        code: "123456",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
  });

  it("PasswordResetEmail renders brand logo", async () => {
    const html = await render(
      PasswordResetEmail({
        resetLink: "https://example.com/reset",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
  });

  it("StatusChangeEmail renders brand logo", async () => {
    const html = await render(
      StatusChangeEmail({
        postTitle: "Test",
        postUrl: "https://example.com/post/1",
        previousStatus: "open",
        newStatus: "in_progress",
        organizationName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
    expect(html).toContain('alt="Acme"');
  });

  it("NewCommentEmail renders brand logo", async () => {
    const html = await render(
      NewCommentEmail({
        postTitle: "Test",
        postUrl: "https://example.com/post/1",
        commenterName: "Carol",
        commentPreview: "Great idea",
        isTeamMember: false,
        organizationName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
    expect(html).toContain('alt="Acme"');
  });

  it("ChangelogPublishedEmail renders brand logo", async () => {
    const html = await render(
      ChangelogPublishedEmail({
        changelogTitle: "v1.0",
        changelogUrl: "https://example.com/changelog",
        contentPreview: "New features",
        organizationName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
    expect(html).toContain('alt="Acme"');
  });

  it("FeedbackLinkedEmail renders brand logo", async () => {
    const html = await render(
      FeedbackLinkedEmail({
        postTitle: "Test",
        postUrl: "https://example.com/post/1",
        workspaceName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
        logoUrl: BRAND_LOGO,
      }),
    );
    expect(html).toContain(BRAND_LOGO);
    expect(html).not.toContain(emailAsset("mark"));
    expect(html).toContain('alt="Acme"');
  });
});

describe("email templates fall back to default logo when logoUrl not provided", () => {
  it("WelcomeEmail renders default logo", async () => {
    const html = await render(
      WelcomeEmail({
        name: "Alice",
        workspaceName: "Acme",
        dashboardUrl: "https://example.com/dashboard",
      }),
    );
    expect(html).toContain(emailAsset("mark"));
  });

  it("InvitationEmail renders default logo", async () => {
    const html = await render(
      InvitationEmail({
        invitedByName: "Bob",
        organizationName: "Acme",
        inviteLink: "https://example.com/invite",
      }),
    );
    expect(html).toContain(emailAsset("mark"));
  });

  it("MagicLinkEmail renders default logo", async () => {
    const html = await render(
      MagicLinkEmail({
        signInUrl: "https://example.com/verify-magic-link?token=abc",
        code: "123456",
      }),
    );
    expect(html).toContain(emailAsset("mark"));
  });

  it("PasswordResetEmail renders default logo", async () => {
    const html = await render(
      PasswordResetEmail({ resetLink: "https://example.com/reset" }),
    );
    expect(html).toContain(emailAsset("mark"));
  });

  it("StatusChangeEmail renders default logo", async () => {
    const html = await render(
      StatusChangeEmail({
        postTitle: "Test",
        postUrl: "https://example.com/post/1",
        previousStatus: "open",
        newStatus: "complete",
        organizationName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
      }),
    );
    expect(html).toContain(emailAsset("mark"));
  });

  it("NewCommentEmail renders default logo", async () => {
    const html = await render(
      NewCommentEmail({
        postTitle: "Test",
        postUrl: "https://example.com/post/1",
        commenterName: "Carol",
        commentPreview: "Great idea",
        isTeamMember: false,
        organizationName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
      }),
    );
    expect(html).toContain(emailAsset("mark"));
  });

  it("ChangelogPublishedEmail renders default logo", async () => {
    const html = await render(
      ChangelogPublishedEmail({
        changelogTitle: "v1.0",
        changelogUrl: "https://example.com/changelog",
        contentPreview: "New features",
        organizationName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
      }),
    );
    expect(html).toContain(emailAsset("mark"));
  });

  it("FeedbackLinkedEmail renders default logo", async () => {
    const html = await render(
      FeedbackLinkedEmail({
        postTitle: "Test",
        postUrl: "https://example.com/post/1",
        workspaceName: "Acme",
        unsubscribeUrl: "https://example.com/unsub",
      }),
    );
    expect(html).toContain(emailAsset("mark"));
  });
});

it("resolves default logo configuration at render time", async () => {
  try {
    vi.stubEnv("KANEO_EMAIL_ASSETS_URL", "");
    vi.stubEnv("KANEO_CLIENT_URL", "https://app.quills.test");
    const props = {
      name: "Alice",
      workspaceName: "Acme",
      dashboardUrl: "https://app.quills.test/dashboard",
    };
    expect(await render(WelcomeEmail(props))).toContain(
      'src="https://app.quills.test/email/mark.png?brand=',
    );
    vi.stubEnv("KANEO_EMAIL_ASSETS_URL", "https://assets.quills.test/mail");
    expect(await render(WelcomeEmail(props))).toContain(
      'src="https://assets.quills.test/mail/mark.png?brand=',
    );
  } finally {
    vi.unstubAllEnvs();
  }
});
