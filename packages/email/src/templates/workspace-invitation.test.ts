import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
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
        locale: "fr-FR",
      }),
    );

    expect(html).toContain("Rejoindre Équipe Produit");
    expect(html).toContain("Accepter l’invitation");
    expect(html).toContain("Camille (camille@example.com)");
  });
});
