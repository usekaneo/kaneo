import type { ReceivedInvitation, SentInvitation } from "../api/invitations.js";
import { isoTimestamp } from "./iso-timestamp.js";

export type SentInvitationJson = {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly expiresAt: string | null;
  readonly createdAt: string | null;
  readonly url: string;
};

export type ReceivedInvitationJson = {
  readonly id: string;
  readonly email: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly inviterName: string;
  readonly expiresAt: string | null;
};

export function invitationUrl(webUrl: string, id: string): string {
  return `${webUrl.replace(/\/+$/, "")}/invitation/accept/${encodeURIComponent(id)}`;
}

export function toSentInvitationJson(
  invitation: SentInvitation,
  webUrl: string,
): SentInvitationJson {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: isoTimestamp(invitation.expiresAt),
    createdAt: isoTimestamp(invitation.createdAt),
    url: invitationUrl(webUrl, invitation.id),
  };
}

export function isPending(invitation: SentInvitationJson, now: Date): boolean {
  return (
    invitation.status === "pending" &&
    invitation.expiresAt !== null &&
    new Date(invitation.expiresAt).getTime() > now.getTime()
  );
}

export function toReceivedInvitationJson(
  invitation: ReceivedInvitation,
): ReceivedInvitationJson {
  return {
    id: invitation.id,
    email: invitation.email,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspaceName,
    inviterName: invitation.inviterName,
    expiresAt: isoTimestamp(invitation.expiresAt),
  };
}
