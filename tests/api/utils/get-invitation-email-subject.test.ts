import { brand } from "@kaneo/branding";
import { describe, expect, it } from "vite-plus/test";
import { getInvitationEmailSubject } from "../../../apps/api/src/utils/get-invitation-email-subject";

describe("getInvitationEmailSubject", () => {
  it("preserves user-supplied names and a custom instance name", () => {
    expect(
      getInvitationEmailSubject("en-US", "Kaneo", "Kaneo team", "Acme"),
    ).toBe("Kaneo invited you to join Kaneo team on Acme");
  });
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
      `Alice vous invite à rejoindre Équipe produit sur ${brand.name}`,
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
      `Alice hat dich eingeladen, Produkt auf ${brand.name} beizutreten`,
    );
  });

  it("uses Brazilian Portuguese copy for regional Portuguese locales", () => {
    const locale = "pt-BR";
    const inviterName = "Alice";
    const workspaceName = "Equipe produto";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe(
      `Alice convidou você para participar de Equipe produto no ${brand.name}`,
    );
  });

  it("uses Japanese copy for Japanese locales", () => {
    const locale = "ja-JP";
    const inviterName = "Alice";
    const workspaceName = "プロダクト";

    const subject = getInvitationEmailSubject(
      locale,
      inviterName,
      workspaceName,
    );

    expect(subject).toBe(
      `Alice さんが ${brand.name} の「プロダクト」にあなたを招待しました`,
    );
  });

  it("uses Traditional Chinese copy for zh-TW", () => {
    expect(getInvitationEmailSubject("zh-TW", "Alice", "產品團隊")).toBe(
      `Alice 邀請你加入 ${brand.name} 上的 產品團隊`,
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

    expect(subject).toBe(`Alice invited you to join Producto on ${brand.name}`);
  });
});
