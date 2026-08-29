import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import enUS from "../../../../i18n/en-US.json";
import frFR from "../../../../i18n/fr-FR.json";
import jaJP from "../../../../i18n/ja-JP.json";
import WorkspaceInvitationEmail from "./workspace-invitation";

describe("WorkspaceInvitationEmail", () => {
  it("renders the invitation in French for a French locale", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Équipe Produit",
        inviterName: "Camille",
        inviterEmail: "camille@example.com",
        invitationLink: "https://kaneo.example/invite/abc",
        to: "invite@example.com",
        copy: frFR.invitations.email,
      }),
    );

    expect(html).toContain("Rejoindre Équipe Produit");
    expect(html).toContain("Accepter l’invitation");
    expect(html).toContain("Camille (camille@example.com)");
  });

  it("renders the invitation in Japanese for a Japanese locale", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "プロダクト",
        inviterName: "アリス",
        inviterEmail: "alice@example.com",
        invitationLink: "https://kaneo.example/invite/abc",
        to: "invite@example.com",
        copy: jaJP.invitations.email,
      }),
    );

    expect(html).toContain("「プロダクト」に参加");
    expect(html).toContain("招待を承諾");
    expect(html).toContain("アリス (alice@example.com)");
  });
});

describe("WorkspaceInvitationEmail default copy", () => {
  it("renders without a copy prop so previews and exports work", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://kaneo.app/invite/abc123",
        to: "invitee@example.com",
      }),
    );

    expect(html).toContain("Join Acme Inc");
    expect(html).toContain("Accept invitation");
  });

  it("keeps the fallback in sync with the en-US bundle", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://kaneo.app/invite/abc123",
        to: "invitee@example.com",
      }),
    );
    const withEnUs = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://kaneo.app/invite/abc123",
        to: "invitee@example.com",
        copy: enUS.invitations.email,
      }),
    );

    expect(html).toBe(withEnUs);
  });
});
