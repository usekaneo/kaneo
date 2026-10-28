import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { sendTestEmail } from "./send-email";

const smtp = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sharedSend: vi.fn(),
  testSend: vi.fn(),
  close: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  createTransport: smtp.createTransport.mockImplementation((options) =>
    options.connectionTimeout
      ? { sendMail: smtp.testSend, close: smtp.close }
      : { sendMail: smtp.sharedSend },
  ),
}));
vi.mock("dotenv-mono", () => ({ config: () => {} }));

describe("sendTestEmail", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("bounds only the test transport and closes it after a stalled send fails", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_FROM", "kaneo@example.test");
    smtp.testSend.mockRejectedValue(
      Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }),
    );

    await expect(
      sendTestEmail("admin@example.test", "Test", {}),
    ).rejects.toMatchObject({ code: "ETIMEDOUT" });

    expect(smtp.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      }),
    );
    expect(smtp.sharedSend).not.toHaveBeenCalled();
    expect(smtp.close).toHaveBeenCalledOnce();
  });
});
