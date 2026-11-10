/** The sign-in email's subject carries the code and the workspace, so it reads without opening. */
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

import { sendMagicLinkEmail } from "../index";
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

describe("sendMagicLinkEmail subject", () => {
  it("names the code and the workspace", async () => {
    await sendMagicLinkEmail({
      to: sealedTo("sam@acme.test"),
      signInUrl: "https://acme.test/verify?token=t",
      code: "482913",
      workspaceName: "Acme",
    });
    expect((sendMailMock.mock.calls[0][0] as { subject: string }).subject).toBe(
      "482913 is your code for Acme",
    );
  });

  it("still leads with the code when the workspace has no name", async () => {
    await sendMagicLinkEmail({
      to: sealedTo("sam@acme.test"),
      signInUrl: "https://acme.test/verify?token=t",
      code: "482913",
    });
    expect((sendMailMock.mock.calls[0][0] as { subject: string }).subject).toBe(
      "482913 is your sign-in code",
    );
  });
});
