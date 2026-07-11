export function getInvitationEmailSubject(
  locale: string | null,
  inviterName: string,
  workspaceName: string,
) {
  const normalizedLocale = locale?.toLowerCase();

  if (normalizedLocale?.startsWith("de")) {
    return `${inviterName} hat dich eingeladen, ${workspaceName} auf Kaneo beizutreten`;
  }

  if (normalizedLocale?.startsWith("fr")) {
    return `${inviterName} vous invite à rejoindre ${workspaceName} sur Kaneo`;
  }

  return `${inviterName} invited you to join ${workspaceName} on Kaneo`;
}
