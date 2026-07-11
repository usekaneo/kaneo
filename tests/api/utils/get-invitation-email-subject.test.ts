import { describe, expect, it } from "vitest";
import { getInvitationEmailSubject } from "../../../apps/api/src/utils/get-invitation-email-subject";

describe("getInvitationEmailSubject", () => {
  it("uses French copy for regional French locales", () => {
    expect(getInvitationEmailSubject("fr-FR", "Alice", "Équipe produit")).toBe(
      "Alice vous invite à rejoindre Équipe produit sur Kaneo",
    );
  });

  it("keeps German and English fallbacks unchanged", () => {
    expect(getInvitationEmailSubject("de-DE", "Alice", "Produkt")).toBe(
      "Alice hat dich eingeladen, Produkt auf Kaneo beizutreten",
    );
    expect(getInvitationEmailSubject("es-ES", "Alice", "Producto")).toBe(
      "Alice invited you to join Producto on Kaneo",
    );
  });
});
