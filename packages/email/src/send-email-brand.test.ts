import type { ReactElement } from "react";
import { render } from "react-email";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { setBrandNameResolver } from "./brand";
import {
  sendMagicLinkEmail,
  sendNotificationEmail,
  sendPasswordResetEmail,
} from "./send-email";

const smtp = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({ createTransport: () => smtp }));
vi.mock("dotenv-mono", () => ({ config: () => {} }));
vi.mock("react-email", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-email")>();
  return { ...original, render: vi.fn(original.render) };
});

describe("email instance name", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_FROM", "kaneo@example.test");
    smtp.sendMail.mockClear();
  });
  afterEach(() => {
    setBrandNameResolver(async () => null);
    vi.unstubAllEnvs();
  });

  it("preserves Kaneo in a task title in the notification subject", async () => {
    setBrandNameResolver(async () => "Acme");
    const title = "You were assigned to Upgrade Kaneo";
    await sendNotificationEmail("member@example.test", title, {
      title,
      message: "Upgrade Kaneo",
    });
    expect(smtp.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: title }),
    );
  });

  it("inserts replacement tokens in an instance name literally", async () => {
    setBrandNameResolver(async () => "Acme $&");
    await sendMagicLinkEmail(
      "member@example.test",
      (name) => `Login for ${name}`,
      {
        magicLink: "https://example.test/sign-in",
      },
    );
    expect(smtp.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Login for Acme $&",
        html: expect.stringContaining("Acme $&amp;"),
      }),
    );
  });

  it("resolves the password reset subject to a string using one name per send", async () => {
    const resolveName = vi
      .fn()
      .mockResolvedValueOnce("Acme $&")
      .mockResolvedValueOnce("Other");
    setBrandNameResolver(resolveName);
    await sendPasswordResetEmail(
      "member@example.test",
      (name) => `${name}-Passwort zurücksetzen`,
      {
        resetLink: "https://example.test/reset",
        userName: "Upgrade Kaneo",
        locale: "de-DE",
      },
    );
    expect(resolveName).toHaveBeenCalledTimes(1);
    expect(smtp.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Acme $&-Passwort zurücksetzen",
        html: expect.stringContaining("Acme $&amp;"),
      }),
    );
    expect(smtp.sendMail.mock.calls[0]?.[0].html).toContain("Upgrade Kaneo");
  });

  it("uses the same name in the body and subject across concurrent sends", async () => {
    let releaseFirst!: () => void;
    let firstRendered!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      firstRendered = resolve;
    });
    const original =
      await vi.importActual<typeof import("react-email")>("react-email");
    vi.mocked(render).mockImplementationOnce(async (template: ReactElement) => {
      const html = await original.render(template);
      firstRendered();
      await gate;
      return html;
    });
    const resolveName = vi
      .fn()
      .mockResolvedValueOnce("Alpha")
      .mockResolvedValueOnce("Beta");
    setBrandNameResolver(resolveName);
    const first = sendMagicLinkEmail(
      "first@example.test",
      (name) => `Login for ${name}`,
      {
        magicLink: "https://example.test/sign-in",
      },
    );
    await ready;
    try {
      await sendMagicLinkEmail(
        "second@example.test",
        (name) => `Login for ${name}`,
        {
          magicLink: "https://example.test/sign-in",
        },
      );
    } finally {
      releaseFirst();
    }
    await first;
    expect(resolveName).toHaveBeenCalledTimes(2);
    for (const [to, name] of [
      ["first@example.test", "Alpha"],
      ["second@example.test", "Beta"],
    ]) {
      expect(smtp.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to,
          subject: `Login for ${name}`,
          html: expect.stringContaining(name!),
        }),
      );
    }
  });
});
