import { describe, expect, it } from "vite-plus/test";
import { parseInviteEmails } from "./invite-emails";

describe("parseInviteEmails", () => {
  it("ignores blank fields and dedupes case-insensitively", () => {
    expect(parseInviteEmails([" a@example.com ", "", "A@example.com"])).toEqual(
      { ok: true, emails: ["a@example.com"] },
    );
  });

  it("reports the positions of malformed addresses", () => {
    expect(parseInviteEmails(["a@example.com", "", "nope"])).toEqual({
      ok: false,
      invalidIndexes: [2],
    });
  });

  it("returns nothing to send when every field is blank", () => {
    expect(parseInviteEmails(["", "  "])).toEqual({ ok: true, emails: [] });
  });
});
