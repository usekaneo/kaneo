import React from "react";
void React;
/**
 * The email a workspace admin gets when a sending domain stops verifying.
 * Its job is to name the record that failed, so each case reads the text.
 */
import { describe, expect, it } from "vite-plus/test";
import { render } from "@react-email/components";
import { SendingDomainAttentionEmail } from "../templates/sending-domain-attention";

function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("SendingDomainAttentionEmail", () => {
  it("says the signing key is not working when no listed record is at fault", async () => {
    const text = visibleText(
      await render(
        SendingDomainAttentionEmail({
          domain: "acme.com",
          record: "signing-key",
        }),
      ),
    );
    expect(text).toContain("The signing key for acme.com isn't working.");
  });

  it("names the domain and the record that is missing", async () => {
    const text = visibleText(
      await render(
        SendingDomainAttentionEmail({
          domain: "acme.com",
          record: {
            purpose: "mail-from",
            type: "MX",
            name: "qb-bounce.acme.com",
            state: "missing",
          },
          settingsUrl: "https://help.example.com/admin/settings/channels/email",
        }),
      ),
    );
    expect(text).toContain("Sending from acme.com needs attention");
    expect(text).toContain(
      "The return path record (MX qb-bounce.acme.com) is missing.",
    );
    expect(text).toContain(
      "Replies send from the default address until it is fixed.",
    );
    expect(text).toContain("to see every record and verify.");
  });

  it("says what was found instead when the value is wrong", async () => {
    const text = visibleText(
      await render(
        SendingDomainAttentionEmail({
          domain: "acme.com",
          record: {
            purpose: "ownership",
            type: "TXT",
            name: "_quackback.acme.com",
            state: "mismatch",
            seen: "quackback-domain-verification=old",
          },
        }),
      ),
    );
    expect(text).toContain(
      "The ownership record (TXT _quackback.acme.com) has a different value: quackback-domain-verification=old.",
    );
  });

  it("names a proxied DKIM record", async () => {
    const text = visibleText(
      await render(
        SendingDomainAttentionEmail({
          domain: "acme.com",
          record: {
            purpose: "dkim",
            type: "CNAME",
            name: "tok._domainkey.acme.com",
            state: "proxied",
          },
        }),
      ),
    );
    expect(text).toContain(
      "The DKIM record (CNAME tok._domainkey.acme.com) is proxied. Turn off any proxy for it.",
    );
  });

  it("falls back to the provider when every record still looks right", async () => {
    const text = visibleText(
      await render(SendingDomainAttentionEmail({ domain: "acme.com" })),
    );
    expect(text).toContain("The mail provider stopped confirming acme.com.");
  });

  it("links to the settings page when given one", async () => {
    const html = await render(
      SendingDomainAttentionEmail({
        domain: "acme.com",
        settingsUrl: "https://help.example.com/admin/settings/channels/email",
      }),
    );
    expect(html).toContain(
      'href="https://help.example.com/admin/settings/channels/email"',
    );
  });

  it("uses no em dash in what it says", async () => {
    const html = await render(
      SendingDomainAttentionEmail({ domain: "acme.com" }),
    );
    expect(html).not.toContain("—");
  });

  it.each([
    [
      "truncated",
      "The DKIM record (TXT qb1._domainkey.acme.com) was cut short by your DNS host.",
    ],
    [
      "quoted",
      "The DKIM record (TXT qb1._domainkey.acme.com) has quote marks saved in its value.",
    ],
  ] as const)(
    "names a value the DNS host mangled (%s)",
    async (reason, sentence) => {
      const text = visibleText(
        await render(
          SendingDomainAttentionEmail({
            domain: "acme.com",
            record: {
              purpose: "dkim",
              type: "TXT",
              name: "qb1._domainkey.acme.com",
              state: "mismatch",
              seen: "v=DKIM1; k=rsa; p=AAA",
              reason,
            },
          }),
        ),
      );
      expect(text).toContain(sentence);
    },
  );
});
