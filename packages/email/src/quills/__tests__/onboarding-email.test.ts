/**
 * The setup emails render the caller's copy in the recipient's language: the
 * document carries that language and direction, and the share link reads left
 * to right even inside right-to-left copy.
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

import { sendInvitationEmail, sendOnboardingWelcomeEmail } from "../index";
import { sealedTo } from "./brands";

const saved: Record<string, string | undefined> = {};
const KEYS = ["EMAIL_SMTP_HOST", "EMAIL_SES_ACCESS_KEY_ID", "EMAIL_FROM"];
beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.EMAIL_SMTP_HOST = "smtp.example.com";
  process.env.EMAIL_FROM = "noreply@example.com";
  sendMailMock.mockClear();
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] !== undefined) process.env[k] = saved[k];
    else delete process.env[k];
  }
});

describe("sendOnboardingWelcomeEmail", () => {
  it("sends the copy it is given, in its language and direction", async () => {
    await sendOnboardingWelcomeEmail({
      to: "sam@acme.test",
      subject: "Acme جاهز، سام",
      workspaceName: "Acme",
      lang: "ar",
      dir: "rtl",
      preview: "Acme جاهز",
      heading: "Acme جاهز",
      paragraphs: ["لوحتك متاحة الآن."],
      share: {
        label: "رابط لوحتك للمشاركة",
        url: "https://acme.test/",
        text: "acme.test",
      },
      cta: { label: "افتح Acme", url: "https://acme.test/admin" },
      footer: {
        reason: "أعددت Acme للتو.",
        unsubscribeLabel: "إيقاف نصائح الإعداد",
      },
      unsubscribeUrl:
        "https://acme.test/unsubscribe?token=6f1c1c47-3c0e-4d55-9a43-0d2a4f1c9b10",
    });

    const call = sendMailMock.mock.calls[0][0] as {
      subject: string;
      html: string;
      text: string;
    };
    expect(call.subject).toBe("Acme جاهز، سام");
    expect(call.html).toMatch(/<html[^>]*lang="ar"/);
    expect(call.html).toMatch(/<html[^>]*dir="rtl"/);
    expect(call.html).toContain("لوحتك متاحة الآن.");
    expect(call.html).toContain('href="https://acme.test/"');
    expect(call.html).toContain("إيقاف نصائح الإعداد");
    expect(call.html).not.toContain("Notification preferences");
    expect(call.text).not.toContain("Notification preferences");
    expect(call.text).toContain("acme.test");
  });
});

describe("sendInvitationEmail", () => {
  it("sends the localised invitation with its subject, language and direction", async () => {
    await sendInvitationEmail({
      to: sealedTo("kim@acme.test"),
      invitedByName: "Sam",
      workspaceName: "Acme",
      inviteLink: "https://acme.test/invite/1",
      copy: {
        lang: "de",
        dir: "ltr",
        subject: "Sam hat dich zu Acme eingeladen",
        preview: "Sam hat dich ins Team von Acme eingeladen.",
        heading: "Tritt Acme bei",
        body: "Sam hat dich ins Team von Acme eingeladen.",
        cta: "Einladung annehmen",
        fallback: "Oder füge diesen Link in deinen Browser ein:",
        footer: "Nicht erwartet? Dann kannst du diese E-Mail ignorieren.",
      },
    });
    const call = sendMailMock.mock.calls[0][0] as {
      subject: string;
      html: string;
    };
    expect(call.subject).toBe("Sam hat dich zu Acme eingeladen");
    expect(call.html).toMatch(/<html[^>]*lang="de"/);
    expect(call.html).toContain("Einladung annehmen");
  });

  it("reads in English, naming the inviter, without copy", async () => {
    await sendInvitationEmail({
      to: sealedTo("kim@acme.test"),
      invitedByName: "Sam",
      workspaceName: "Acme",
      inviteLink: "https://acme.test/invite/1",
    });
    const call = sendMailMock.mock.calls[0][0] as {
      subject: string;
      html: string;
    };
    expect(call.subject).toBe("Sam invited you to Acme");
    expect(call.html).toContain("Accept invitation");
  });
});
