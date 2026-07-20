type GetInvitationAcceptUrlOptions = {
  clientUrl?: string;
};

export function getInvitationAcceptUrl(
  invitationId: string,
  options?: GetInvitationAcceptUrlOptions,
): string | null {
  const baseUrl = import.meta.env.VITE_CLIENT_URL || options?.clientUrl || "";
  const trimmed = baseUrl.replace(/\/$/, "");

  if (!trimmed) {
    return null;
  }

  return `${trimmed}/invitation/accept/${invitationId}`;
}
