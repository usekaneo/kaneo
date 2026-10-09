import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import type {
  ReceivedInvitationJson,
  SentInvitationJson,
} from "./invitation-json.js";
import { formatDay } from "./render-member-list.js";
import { roleLabel } from "./roles.js";

function expires(iso: string | null, now: Date): string {
  const day = formatDay(iso, now);
  return day ? `expires ${day}` : "";
}

export function renderSentInvitations(
  ui: Ui,
  view: {
    readonly invitations: ReadonlyArray<SentInvitationJson>;
    readonly now: Date;
  },
): string[] {
  const { theme } = ui;
  if (view.invitations.length === 0) {
    return [
      "",
      `  ${theme.muted("No pending invitations. Invite someone with kaneo member invite <email>.")}`,
      "",
    ];
  }
  return [
    "",
    ...renderTable(
      ui,
      view.invitations,
      [
        {
          header: "Email",
          flex: true,
          minWidth: 16,
          cell: (invitation): Cell => [
            text(invitation.email, theme.strong, invitation.url),
          ],
        },
        {
          header: "Role",
          cell: (invitation): Cell => [text(roleLabel(invitation.role))],
        },
        {
          header: "Expires",
          optional: true,
          cell: (invitation): Cell => [
            text(expires(invitation.expiresAt, view.now), theme.muted),
          ],
        },
        {
          header: "ID",
          optional: true,
          cell: (invitation): Cell => [text(invitation.id, theme.muted)],
        },
      ],
      { width: ui.caps.columns, indent: 2 },
    ),
    "",
  ];
}

export function renderReceivedInvitations(
  ui: Ui,
  view: {
    readonly invitations: ReadonlyArray<ReceivedInvitationJson>;
    readonly now: Date;
  },
): string[] {
  const { theme } = ui;
  if (view.invitations.length === 0) {
    return [
      "",
      `  ${theme.muted("You have no pending invitations.")}`,
      `  ${theme.muted("Invitations only show here once your email address is verified.")}`,
      "",
    ];
  }
  return [
    "",
    ...renderTable(
      ui,
      view.invitations,
      [
        {
          header: "Workspace",
          flex: true,
          minWidth: 12,
          cell: (invitation): Cell => [
            text(invitation.workspaceName, theme.strong),
          ],
        },
        {
          header: "From",
          flex: true,
          minWidth: 10,
          optional: true,
          cell: (invitation): Cell => [
            text(`from ${invitation.inviterName}`, theme.muted),
          ],
        },
        {
          header: "Expires",
          optional: true,
          cell: (invitation): Cell => [
            text(expires(invitation.expiresAt, view.now), theme.muted),
          ],
        },
        {
          header: "ID",
          cell: (invitation): Cell => [text(invitation.id, theme.muted)],
        },
      ],
      { width: ui.caps.columns, indent: 2 },
    ),
    "",
    `  ${theme.muted("Run")} ${theme.strong("kaneo invitation accept <id>")} ${theme.muted("to join.")}`,
    "",
  ];
}
