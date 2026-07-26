import deDE from "../../../../i18n/de-DE.json";
import enUS from "../../../../i18n/en-US.json";
import frFR from "../../../../i18n/fr-FR.json";

const messages = {
  de: deDE.invitations.email,
  en: enUS.invitations.email,
  fr: frFR.invitations.email,
} as const;

export function getWorkspaceInvitationEmailCopy(locale?: string | null) {
  const normalizedLocale = locale?.toLowerCase();

  if (normalizedLocale?.startsWith("de")) return messages.de;
  if (normalizedLocale?.startsWith("fr")) return messages.fr;

  return messages.en;
}
