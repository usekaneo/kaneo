/**
 * Every email carrying an unsubscribe token also carries RFC 2369
 * `List-Unsubscribe` and RFC 8058 `List-Unsubscribe-Post` headers, so the mail
 * client's own unsubscribe button works in one click. The one-click URL is the
 * emailed link itself: a POST there unsubscribes, while a GET only shows the
 * confirm page.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-msg-id" });
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import { listUnsubscribeHeaders } from "../list-unsubscribe";
import {
  sendChangelogPublishedEmail,
  sendInvitationEmail,
  sendOnboardingNudgeEmail,
  sendStatusChangeEmail,
} from "../index";
import { sealedTo } from "./brands";

const ENV_KEYS = [
  "EMAIL_SMTP_HOST",
  "EMAIL_SES_ACCESS_KEY_ID",
  "EMAIL_SES_SECRET_ACCESS_KEY",
  "EMAIL_FROM",
];
const saved: Record<string, string | undefined> = {};
const TOKEN = "6f1c1c47-3c0e-4d55-9a43-0d2a4f1c9b10";
const PAGE = `https://acme.test/unsubscribe?token=${TOKEN}`;

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.EMAIL_SMTP_HOST = "smtp.example.com";
  process.env.EMAIL_FROM = "noreply@example.com";
  sendMailMock.mockClear();
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] !== undefined) process.env[key] = saved[key];
    else delete process.env[key];
  }
});

function sentHeaders(): Record<string, string> | undefined {
  return (sendMailMock.mock.calls[0][0] as { headers?: Record<string, string> })
    .headers;
}

describe("listUnsubscribeHeaders", () => {
  it("offers one-click on the token link itself", () => {
    expect(listUnsubscribeHeaders(PAGE)).toEqual({
      "List-Unsubscribe": `<${PAGE}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("offers a plain link, without one-click, over plain http", () => {
    const local = `http://localhost:3000/unsubscribe?token=${TOKEN}`;
    expect(listUnsubscribeHeaders(local)).toEqual({
      "List-Unsubscribe": `<${local}>`,
    });
  });

  it("adds nothing for a missing or unparsable link", () => {
    expect(listUnsubscribeHeaders(undefined)).toEqual({});
    expect(listUnsubscribeHeaders("not a url")).toEqual({});
  });
});

describe("token emails carry the headers", () => {
  it("the setup nudge", async () => {
    await sendOnboardingNudgeEmail({
      to: "sam@acme.test",
      subject: "Your next step in Acme",
      workspaceName: "Acme",
      lang: "en",
      dir: "ltr",
      preview: "Your next step in Acme",
      heading: "Your next step",
      paragraphs: ["This takes about a minute."],
      cta: { label: "Share your board", url: "https://acme.test/admin" },
      footer: {
        reason: "You set up Acme this week.",
        unsubscribeLabel: "Stop setup tips",
      },
      unsubscribeUrl: PAGE,
    });
    expect(sentHeaders()).toMatchObject({
      "List-Unsubscribe": `<${PAGE}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("a status change", async () => {
    await sendStatusChangeEmail({
      to: "sam@acme.test",
      postTitle: "Dark mode",
      postUrl: "https://acme.test/b/f/posts/1",
      previousStatus: "open",
      newStatus: "planned",
      workspaceName: "Acme",
      unsubscribeUrl: PAGE,
    });
    expect(sentHeaders()).toMatchObject({ "List-Unsubscribe": `<${PAGE}>` });
  });

  it("a changelog email", async () => {
    await sendChangelogPublishedEmail({
      to: "sam@acme.test",
      workspaceName: "Acme",
      changelogTitle: "New editor",
      contentPreview: "It is faster.",
      changelogUrl: "https://acme.test/changelog/1",
      unsubscribeUrl: PAGE,
    });
    expect(sentHeaders()).toMatchObject({ "List-Unsubscribe": `<${PAGE}>` });
  });

  it("but not an invitation, which has nothing to unsubscribe from", async () => {
    await sendInvitationEmail({
      to: sealedTo("new@acme.test"),
      invitedByName: "Sam",
      workspaceName: "Acme",
      inviteLink: "https://acme.test/invite/1",
    });
    expect(sentHeaders()?.["List-Unsubscribe"]).toBeUndefined();
  });
});
