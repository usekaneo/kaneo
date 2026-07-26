import { describe, expect, it } from "vitest";
import { getInvitationEmailSubject } from "../../../apps/api/src/utils/get-invitation-email-subject";

describe("getInvitationEmailSubject", () => {
  it("uses French copy for regional French locales", () => {
    const locale = "fr-FR";
    const inviterName = "Alice";
    const workspaceName = "Équipe produit";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe(
      "Alice vous invite à rejoindre Équipe produit sur Kaneo",
    );
  });

  it("keeps the German translation unchanged", () => {
    const locale = "de-DE";
    const inviterName = "Alice";
    const workspaceName = "Produkt";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe(
      "Alice hat dich eingeladen, Produkt auf Kaneo beizutreten",
    );
  });

  it("uses the English fallback for unsupported locales", () => {
    const locale = "es-ES";
    const inviterName = "Alice";
    const workspaceName = "Producto";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe("Alice invited you to join Producto on Kaneo");
  });
});
