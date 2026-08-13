import { describe, expect, it } from "vitest";
import {
  hashTrialEmail,
  normalizeTrialEmail,
} from "../../../apps/api/src/billing/trial-identity";

describe("normalizeTrialEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeTrialEmail("  Andrej@Kaneo.APP ")).toBe("andrej@kaneo.app");
  });

  it("drops plus tags so aliases share one trial", () => {
    expect(normalizeTrialEmail("andrej+trial2@kaneo.app")).toBe(
      "andrej@kaneo.app",
    );
  });

  it("keeps the address when stripping would empty the local part", () => {
    expect(normalizeTrialEmail("+tag@kaneo.app")).toBe("+tag@kaneo.app");
  });

  it("leaves values without an address shape alone", () => {
    expect(normalizeTrialEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("hashTrialEmail", () => {
  it("matches for addresses that normalize to the same mailbox", () => {
    expect(hashTrialEmail("Andrej+one@kaneo.app")).toBe(
      hashTrialEmail("andrej@kaneo.app"),
    );
  });

  it("differs for different mailboxes", () => {
    expect(hashTrialEmail("a@kaneo.app")).not.toBe(
      hashTrialEmail("b@kaneo.app"),
    );
  });

  it("does not store the address itself", () => {
    expect(hashTrialEmail("andrej@kaneo.app")).not.toContain("kaneo");
  });
});
