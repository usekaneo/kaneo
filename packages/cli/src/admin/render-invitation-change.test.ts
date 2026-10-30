import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import {
  renderInvitationAnswer,
  renderInvitationCanceled,
  renderInvites,
} from "./render-invitation-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderInvites", () => {
  it("prints one line per address", () => {
    expect(
      renderInvites(ui, [
        {
          id: "inv_1",
          email: "grace@example.com",
          role: "member",
          resent: false,
          emailSent: true,
          url: "http://localhost:5173/invitation/accept/inv_1",
        },
        {
          id: "inv_2",
          email: "alan@example.com",
          role: "admin",
          resent: true,
          emailSent: true,
          url: "http://localhost:5173/invitation/accept/inv_2",
        },
      ]),
    ).toEqual([
      "",
      "  ✓ Invited grace@example.com · Member",
      "  ✓ Resent the invitation to alan@example.com · Admin",
      "",
    ]);
  });

  it("offers the link when the email could not be sent", () => {
    expect(
      renderInvites(ui, [
        {
          id: "inv_1",
          email: "grace@example.com",
          role: "member",
          resent: false,
          emailSent: false,
          url: "http://localhost:5173/invitation/accept/inv_1",
        },
      ]),
    ).toEqual([
      "",
      "  ▲ Invited grace@example.com · Member, but the email could not be sent",
      "    Share the link instead: http://localhost:5173/invitation/accept/inv_1",
      "",
    ]);
  });
});

describe("renderInvitationAnswer", () => {
  it("confirms joining with a next step", () => {
    expect(
      renderInvitationAnswer(ui, {
        accepted: true,
        workspaceName: "Side Project",
        next: "Run kaneo workspace use side-project to switch to it.",
      }),
    ).toEqual([
      "",
      "  ✓ Joined Side Project",
      "",
      "  Run kaneo workspace use side-project to switch to it.",
      "",
    ]);
  });

  it("confirms declining without a known workspace name", () => {
    expect(
      renderInvitationAnswer(ui, {
        accepted: false,
        workspaceName: null,
        next: null,
      }),
    ).toEqual(["", "  ✓ Declined the invitation to the workspace", ""]);
  });
});

describe("renderInvitationCanceled", () => {
  it("names the invited address", () => {
    expect(
      renderInvitationCanceled(ui, { email: "grace@example.com" }),
    ).toEqual(["", "  ✓ Canceled the invitation for grace@example.com", ""]);
  });
});
