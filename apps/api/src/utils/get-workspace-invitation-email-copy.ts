import deDE from "../../../../i18n/de-DE.json";
import enUS from "../../../../i18n/en-US.json";
import frFR from "../../../../i18n/fr-FR.json";
import ptBR from "../../../../i18n/pt-BR.json";
import viVN from "../../../../i18n/vi-VN.json";

const messages = {
  de: deDE.invitations.email,
  en: enUS.invitations.email,
  fr: frFR.invitations.email,
  pt: ptBR.invitations.email,
  vi: viVN.invitations.email,
} as const;

export function getWorkspaceInvitationEmailCopy(locale?: string | null) {
  const normalizedLocale = locale?.toLowerCase();

  if (normalizedLocale?.startsWith("de")) return messages.de;
  if (normalizedLocale?.startsWith("fr")) return messages.fr;
  if (normalizedLocale?.startsWith("pt")) return messages.pt;
  if (normalizedLocale?.startsWith("vi")) return messages.vi;

  return messages.en;
}
