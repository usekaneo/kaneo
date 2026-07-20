export function getInvitationAcceptUrl(invitationId: string): string {
  const baseUrl = import.meta.env.VITE_CLIENT_URL ?? window.location.origin;
  return `${baseUrl}/invitation/accept/${invitationId}`;
}
