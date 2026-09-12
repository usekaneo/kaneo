/**
 * Builds the public URL an invitee opens to accept a workspace invitation.
 *
 * The origin defaults to the browser's own origin rather than KANEO_CLIENT_URL:
 * whoever copies the link is already reaching the app through a URL that works,
 * while KANEO_CLIENT_URL is a server-side setting that can be stale or wrong on
 * a self-hosted instance, producing a link the admin cannot notice is broken.
 *
 * The `origin` parameter exists so this stays testable without a DOM.
 */
export function buildInvitationLink(
  invitationId: string,
  origin: string = window.location.origin,
): string {
  return `${origin.replace(/\/+$/, "")}/invitation/accept/${invitationId}`;
}
