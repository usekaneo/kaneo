import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverEmail, emailFrom, emailProvider } from "./transport";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("emailProvider", () => {
  it("prefers Resend when it has a key and a sender", () => {
    expect(
      emailProvider({
        RESEND_API_KEY: "re_x",
        EMAIL_FROM: "Kaneo <hi@example.com>",
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "old@example.com",
      }),
    ).toBe("resend");
  });

  it("falls back to SMTP, and to nothing", () => {
    expect(
      emailProvider({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "a@b.c" }),
    ).toBe("smtp");
    expect(emailProvider({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(emailProvider({})).toBeNull();
  });

  it("uses EMAIL_FROM before the SMTP sender", () => {
    expect(emailFrom({ EMAIL_FROM: "a@x.com", SMTP_FROM: "b@x.com" })).toBe(
      "a@x.com",
    );
    expect(emailFrom({ SMTP_FROM: "b@x.com" })).toBe("b@x.com");
  });
});

describe("deliverEmail with Resend", () => {
  const env = { RESEND_API_KEY: "re_secret", EMAIL_FROM: "Kaneo <k@x.com>" };

  it("posts the email and returns Resend's id", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await deliverEmail(
      {
        to: "nusrat@example.com",
        subject: "Leave approved",
        html: "<p>ok</p>",
        text: "ok",
        tags: [{ name: "category", value: "leave.decided" }],
      },
      env,
    );

    expect(result).toEqual({ provider: "resend", id: "email_123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_secret",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "Kaneo <k@x.com>",
      to: ["nusrat@example.com"],
      subject: "Leave approved",
      text: "ok",
      tags: [{ name: "category", value: "leave_decided" }],
    });
  });

  it("throws with Resend's reason, never the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Domain not verified" }), {
            status: 403,
          }),
      ),
    );
    await expect(
      deliverEmail({ to: "a@b.c", subject: "s", html: "h" }, env),
    ).rejects.toThrow(/403 Domain not verified/);
    await expect(
      deliverEmail({ to: "a@b.c", subject: "s", html: "h" }, env),
    ).rejects.not.toThrow(/re_secret/);
  });

  it("refuses when nothing is configured", async () => {
    await expect(
      deliverEmail({ to: "a@b.c", subject: "s", html: "h" }, {}),
    ).rejects.toThrow(/not configured/);
  });
});
