import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { roleLabel } from "./roles.js";

export type InviteJson = {
  readonly id: string | null;
  readonly email: string;
  readonly role: string;
  readonly resent: boolean;
  readonly emailSent: boolean;
  readonly url: string | null;
};

export function renderInvites(
  ui: Ui,
  invites: ReadonlyArray<InviteJson>,
): string[] {
  const { theme, glyphs } = ui;
  const lines = [""];
  for (const invite of invites) {
    const email = theme.strong(invite.email);
    const role = theme.muted(`${glyphs.separator} ${roleLabel(invite.role)}`);
    if (!invite.emailSent) {
      lines.push(
        `  ${theme.warning(glyphs.warning)} ${invite.resent ? "Resent" : "Invited"} ${email} ${role}, but the email could not be sent`,
      );
      if (invite.url) {
        lines.push(
          `    ${theme.muted("Share the link instead:")} ${renderCell([text(invite.url, theme.info, invite.url)], ui)}`,
        );
      }
      continue;
    }
    lines.push(
      `  ${theme.success(glyphs.tick)} ${invite.resent ? "Resent the invitation to" : "Invited"} ${email} ${role}`,
    );
  }
  lines.push("");
  return lines;
}

export function renderInvitationAnswer(
  ui: Ui,
  answer: {
    readonly accepted: boolean;
    readonly workspaceName: string | null;
    readonly next: string | null;
  },
): string[] {
  const { theme, glyphs } = ui;
  const workspace = answer.workspaceName
    ? theme.strong(answer.workspaceName)
    : "the workspace";
  const lines = [
    "",
    answer.accepted
      ? `  ${theme.success(glyphs.tick)} Joined ${workspace}`
      : `  ${theme.success(glyphs.tick)} Declined the invitation to ${workspace}`,
    "",
  ];
  if (answer.next) lines.push(`  ${theme.muted(answer.next)}`, "");
  return lines;
}

export function renderInvitationCanceled(
  ui: Ui,
  invitation: { readonly email: string },
): string[] {
  const { theme, glyphs } = ui;
  return [
    "",
    `  ${theme.success(glyphs.tick)} Canceled the invitation for ${theme.strong(invitation.email)}`,
    "",
  ];
}
