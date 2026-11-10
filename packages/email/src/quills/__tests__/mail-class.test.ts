import { describe, expect, it } from "vite-plus/test";
import {
  EMAIL_BILLABLE,
  EMAIL_TENANTED,
  METERED_EMAIL_TYPES,
  isEmailBillable,
  isTenantedEmailType,
} from "../mail-class";

describe("email meter classes", () => {
  it("meters changelog and status-page subscriber sends only", () => {
    const billed = Object.entries(EMAIL_BILLABLE)
      .filter(([, billable]) => billable)
      .map(([type]) => type)
      .sort();
    expect(billed).toEqual([...METERED_EMAIL_TYPES].sort());
  });

  it("does not meter inbox, ticket, or feedback status mail", () => {
    expect(isEmailBillable("ConversationMessageEmail")).toBe(false);
    expect(isEmailBillable("ConversationReplyEmail")).toBe(false);
    expect(isEmailBillable("TicketEventEmail")).toBe(false);
    expect(isEmailBillable("StatusChangeEmail")).toBe(false);
    expect(isEmailBillable("CsatRequestEmail")).toBe(false);
  });

  it("never meters sign-in, security, or invitation mail", () => {
    const exempt = [
      "MagicLinkEmail",
      "PasswordResetEmail",
      "RecoveryCodeUsedEmail",
      "NewSignInEmail",
      "VerifyAddressEmail",
      "InvitationEmail",
      "PortalInviteEmail",
      "SignupNotAllowedEmail",
    ];
    for (const emailType of exempt) {
      expect(isEmailBillable(emailType)).toBe(false);
      expect(METERED_EMAIL_TYPES).not.toContain(emailType);
    }
  });
});

describe("provider tenant classes", () => {
  it("classifies every type the meter classifies, and no other", () => {
    expect(Object.keys(EMAIL_TENANTED).sort()).toEqual(
      Object.keys(EMAIL_BILLABLE).sort(),
    );
  });

  it("keeps sign-in, verification, invitation and security mail untenanted", () => {
    const untenanted = Object.entries(EMAIL_TENANTED)
      .filter(([, tenanted]) => !tenanted)
      .map(([type]) => type)
      .sort();
    expect(untenanted).toEqual(
      [
        "InvitationEmail",
        "MagicLinkEmail",
        "NewSignInEmail",
        "PasswordResetEmail",
        "PortalInviteEmail",
        "RecoveryCodeUsedEmail",
        "SignupNotAllowedEmail",
        "VerifyAddressEmail",
      ].sort(),
    );
  });

  it("tenants workspace mail, a raw send, and a send that names no type", () => {
    expect(isTenantedEmailType("ConversationReplyEmail")).toBe(true);
    expect(isTenantedEmailType("ChangelogPublishedEmail")).toBe(true);
    expect(isTenantedEmailType("RawEmail")).toBe(true);
    expect(isTenantedEmailType(undefined)).toBe(true);
  });

  it("sends a type nobody classified untenanted, as before tenants", () => {
    expect(isTenantedEmailType("SomeNewEmail")).toBe(false);
  });
});
