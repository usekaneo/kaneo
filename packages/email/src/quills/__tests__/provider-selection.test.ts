import { describe, it, expect } from "vite-plus/test";
import { EmailProviderConflictError, resolveEmailProvider } from "../provider";

/**
 * Exactly one outbound provider. Every case passes its own environment, so the
 * selection is read from the argument and never from the test runner's.
 */

const SES = {
  EMAIL_SES_ACCESS_KEY_ID: "AKIAEXAMPLE",
  EMAIL_SES_SECRET_ACCESS_KEY: "secret",
};
const SMTP = { EMAIL_SMTP_HOST: "smtp.acme.test" };
const RESEND = { EMAIL_RESEND_API_KEY: "re_test" };

function conflict(env: Record<string, string>): EmailProviderConflictError {
  try {
    resolveEmailProvider(env);
  } catch (error) {
    if (error instanceof EmailProviderConflictError) return error;
    throw error;
  }
  throw new Error("expected a conflict, got a provider");
}

describe("resolveEmailProvider: a single provider", () => {
  it("selects console when nothing is configured", () => {
    expect(resolveEmailProvider({})).toBe("console");
  });

  it("selects ses from both halves of the SES credential", () => {
    expect(resolveEmailProvider(SES)).toBe("ses");
  });

  it("does not count half an SES credential", () => {
    expect(
      resolveEmailProvider({ EMAIL_SES_ACCESS_KEY_ID: "AKIAEXAMPLE" }),
    ).toBe("console");
    expect(
      resolveEmailProvider({ EMAIL_SES_SECRET_ACCESS_KEY: "secret", ...SMTP }),
    ).toBe("smtp");
  });

  it("selects smtp from EMAIL_SMTP_HOST", () => {
    expect(resolveEmailProvider(SMTP)).toBe("smtp");
  });

  it("selects resend from EMAIL_RESEND_API_KEY", () => {
    expect(resolveEmailProvider(RESEND)).toBe("resend");
  });

  it("selects resend from the RESEND_API_KEY alias", () => {
    expect(resolveEmailProvider({ RESEND_API_KEY: "re_test" })).toBe("resend");
  });

  it("sends with a lone Resend key even when it also receives", () => {
    // One key doing both jobs is the ordinary Resend install.
    expect(
      resolveEmailProvider({ ...RESEND, EMAIL_INBOUND_PROVIDER: "resend" }),
    ).toBe("resend");
  });

  it("treats blank values as unset", () => {
    expect(
      resolveEmailProvider({
        EMAIL_SMTP_HOST: "",
        EMAIL_RESEND_API_KEY: "  ",
        EMAIL_SES_ACCESS_KEY_ID: "",
        EMAIL_SES_SECRET_ACCESS_KEY: "",
      }),
    ).toBe("console");
  });
});

describe("resolveEmailProvider: more than one provider", () => {
  it("refuses SES and SMTP together, naming every variable", () => {
    const error = conflict({ ...SES, ...SMTP });
    expect(error.variables).toEqual([
      "EMAIL_SES_ACCESS_KEY_ID",
      "EMAIL_SES_SECRET_ACCESS_KEY",
      "EMAIL_SMTP_HOST",
    ]);
    expect(error.message).toMatch(/EMAIL_SES_ACCESS_KEY_ID/);
    expect(error.message).toMatch(/EMAIL_SMTP_HOST/);
    expect(error.message).toMatch(/remove all but one/i);
    expect(error.retryable).toBe(false);
  });

  it("refuses SMTP and Resend together", () => {
    const error = conflict({ ...SMTP, ...RESEND });
    expect(error.variables).toEqual([
      "EMAIL_SMTP_HOST",
      "EMAIL_RESEND_API_KEY",
    ]);
    expect(error.message).toMatch(/EMAIL_INBOUND_PROVIDER=resend/);
  });

  it("refuses SES and Resend together, naming the alias that is actually set", () => {
    const error = conflict({ ...SES, RESEND_API_KEY: "re_test" });
    expect(error.variables).toEqual([
      "EMAIL_SES_ACCESS_KEY_ID",
      "EMAIL_SES_SECRET_ACCESS_KEY",
      "RESEND_API_KEY",
    ]);
  });

  it("names both Resend variables when both are set", () => {
    const error = conflict({
      ...SMTP,
      EMAIL_RESEND_API_KEY: "re_a",
      RESEND_API_KEY: "re_b",
    });
    expect(error.variables).toEqual([
      "EMAIL_SMTP_HOST",
      "EMAIL_RESEND_API_KEY",
      "RESEND_API_KEY",
    ]);
  });

  it("refuses all three together", () => {
    const error = conflict({ ...SES, ...SMTP, ...RESEND });
    expect(error.providers).toEqual(["ses", "smtp", "resend"]);
  });

  it("does not mention the inbound exception when Resend is not involved", () => {
    expect(conflict({ ...SES, ...SMTP }).message).not.toMatch(
      /EMAIL_INBOUND_PROVIDER/,
    );
  });
});

describe("resolveEmailProvider: a Resend key kept for inbound mail", () => {
  it("lets SES send while the Resend key receives", () => {
    expect(
      resolveEmailProvider({
        ...SES,
        ...RESEND,
        EMAIL_INBOUND_PROVIDER: "resend",
      }),
    ).toBe("ses");
  });

  it("lets SMTP send while the Resend key receives, case-insensitively", () => {
    expect(
      resolveEmailProvider({
        ...SMTP,
        ...RESEND,
        EMAIL_INBOUND_PROVIDER: "Resend",
      }),
    ).toBe("smtp");
  });

  it("does not excuse a Resend key when inbound is IMAP", () => {
    const error = conflict({
      ...SMTP,
      ...RESEND,
      EMAIL_INBOUND_PROVIDER: "imap",
    });
    expect(error.variables).toEqual([
      "EMAIL_SMTP_HOST",
      "EMAIL_RESEND_API_KEY",
    ]);
  });

  it("does not excuse SES and SMTP together", () => {
    const error = conflict({
      ...SES,
      ...SMTP,
      ...RESEND,
      EMAIL_INBOUND_PROVIDER: "resend",
    });
    expect(error.providers).toEqual(["ses", "smtp"]);
  });
});
