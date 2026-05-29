import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "../../../apps/api/src/utils/is-disposable-email";

describe("isDisposableEmail", () => {
  it("flags base disposable domains observed in the 2026-05-28 abuse", () => {
    expect(isDisposableEmail("foo@yomail.info")).toBe(true);
    expect(isDisposableEmail("foo@mimimail.me")).toBe(true);
    expect(isDisposableEmail("foo@hush2u.com")).toBe(true);
  });

  it("flags wildcard subdomains used by the attackers", () => {
    expect(isDisposableEmail("dwv.dropmail.me-id+abc@dwv.dropmail.me")).toBe(
      true,
    );
    expect(isDisposableEmail("alvughcvo-gn@sbk.10mail.org")).toBe(true);
    expect(isDisposableEmail("bawyjip1wakez5.ao8@wmd.mimimail.me")).toBe(true);
  });

  it("flags common well-known disposable providers", () => {
    expect(isDisposableEmail("foo@mailinator.com")).toBe(true);
    expect(isDisposableEmail("foo@yopmail.com")).toBe(true);
  });

  it("allows real provider domains", () => {
    expect(isDisposableEmail("foo@gmail.com")).toBe(false);
    expect(isDisposableEmail("foo@outlook.com")).toBe(false);
    expect(isDisposableEmail("foo@kaneo.app")).toBe(false);
    expect(isDisposableEmail("foo@zus.pl")).toBe(false);
  });

  it("is case-insensitive on the host", () => {
    expect(isDisposableEmail("Foo@YoMail.Info")).toBe(true);
  });

  it("handles malformed inputs gracefully", () => {
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("no-at-sign")).toBe(false);
    expect(isDisposableEmail("trailing-at@")).toBe(false);
  });
});
