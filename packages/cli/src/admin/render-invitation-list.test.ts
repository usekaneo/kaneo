import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import {
  invitationUrl,
  isPending,
  type ReceivedInvitationJson,
  type SentInvitationJson,
} from "./invitation-json.js";
import {
  renderReceivedInvitations,
  renderSentInvitations,
} from "./render-invitation-list.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const now = new Date(2026, 9, 8, 12);

const sent: SentInvitationJson = {
  id: "inv_9f2c41a7d3",
  email: "grace@example.com",
  role: "member",
  status: "pending",
  expiresAt: new Date(2026, 9, 9, 12).toISOString(),
  createdAt: new Date(2026, 9, 7, 12).toISOString(),
  url: invitationUrl("http://localhost:5173/", "inv_9f2c41a7d3"),
};

const received: ReceivedInvitationJson = {
  id: "inv_4b1e88c2f0",
  email: "ada@example.com",
  workspaceId: "ws_side",
  workspaceName: "Side Project",
  inviterName: "Grace Hopper",
  expiresAt: new Date(2026, 9, 15, 12).toISOString(),
};

describe("invitation helpers", () => {
  it("builds the accept link the web app shares", () => {
    expect(sent.url).toBe(
      "http://localhost:5173/invitation/accept/inv_9f2c41a7d3",
    );
  });

  it("treats canceled and expired invitations as not pending", () => {
    expect(isPending(sent, now)).toBe(true);
    expect(isPending({ ...sent, status: "canceled" }, now)).toBe(false);
    expect(
      isPending(
        { ...sent, expiresAt: new Date(2026, 9, 1).toISOString() },
        now,
      ),
    ).toBe(false);
  });
});

describe("renderSentInvitations", () => {
  it("lists email, role, expiry and id within 80 columns", () => {
    const lines = renderSentInvitations(ui, { invitations: [sent], now });
    expect(lines).toEqual([
      "",
      "  grace@example.com  Member  expires Tomorrow  inv_9f2c41a7d3",
      "",
    ]);
  });

  it("suggests inviting someone when the list is empty", () => {
    expect(renderSentInvitations(ui, { invitations: [], now })[1]).toBe(
      "  No pending invitations. Invite someone with kaneo member invite <email>.",
    );
  });
});

describe("renderReceivedInvitations", () => {
  it("shows the workspace, the inviter and how to accept", () => {
    const lines = renderReceivedInvitations(ui, {
      invitations: [received],
      now,
    });
    expect(lines).toEqual([
      "",
      "  Side Project  from Grace Hopper  expires Oct 15  inv_4b1e88c2f0",
      "",
      "  Run kaneo invitation accept <id> to join.",
      "",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("keeps the id visible when names are long", () => {
    const lines = renderReceivedInvitations(ui, {
      invitations: [
        {
          ...received,
          workspaceName: "The Extremely Long Workspace Name Of Many Words",
          inviterName: "Someone With An Unusually Long Display Name",
        },
      ],
      now,
    });
    expect(lines[1]?.endsWith("inv_4b1e88c2f0")).toBe(true);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });
});
