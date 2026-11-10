import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  EmailConfigError,
  getEmailFrom,
  resetDefaultFromResolver,
  setDefaultFromResolver,
} from "../index";

describe("getEmailFrom", () => {
  const saved = process.env.EMAIL_FROM;

  beforeEach(() => {
    resetDefaultFromResolver();
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    resetDefaultFromResolver();
    if (saved === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = saved;
  });

  it("reads EMAIL_FROM when no resolver is installed", () => {
    process.env.EMAIL_FROM = "Quackback <noreply@example.com>";
    expect(getEmailFrom()).toBe("Quackback <noreply@example.com>");
  });

  it("throws when EMAIL_FROM is unset and no resolver answers", () => {
    expect(() => getEmailFrom()).toThrow(EmailConfigError);
  });

  it("uses the resolver when it returns a From", () => {
    process.env.EMAIL_FROM = "fleet@example.com";
    setDefaultFromResolver(() => "Alpha <noreply@alpha.example>");
    expect(getEmailFrom()).toBe("Alpha <noreply@alpha.example>");
  });

  it("falls through to EMAIL_FROM when the resolver returns null", () => {
    process.env.EMAIL_FROM = "fleet@example.com";
    setDefaultFromResolver(() => null);
    expect(getEmailFrom()).toBe("fleet@example.com");
  });

  it("falls through to EMAIL_FROM when the resolver returns blank", () => {
    process.env.EMAIL_FROM = "fleet@example.com";
    setDefaultFromResolver(() => "   ");
    expect(getEmailFrom()).toBe("fleet@example.com");
  });
});
