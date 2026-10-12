import deDE from "../../../../i18n/de-DE.json";
import enUS from "../../../../i18n/en-US.json";
import frFR from "../../../../i18n/fr-FR.json";
import jaJP from "../../../../i18n/ja-JP.json";
import ptBR from "../../../../i18n/pt-BR.json";
import viVN from "../../../../i18n/vi-VN.json";
import zhTW from "../../../../i18n/zh-TW.json";

const bundles = {
  de: deDE,
  en: enUS,
  fr: frFR,
  ja: jaJP,
  pt: ptBR,
  vi: viVN,
  zhTW: zhTW,
} as const;

function getBundle(locale?: string | null) {
  const normalizedLocale = locale?.toLowerCase();

  if (normalizedLocale?.startsWith("de")) return bundles.de;
  if (normalizedLocale?.startsWith("fr")) return bundles.fr;
  if (normalizedLocale?.startsWith("ja")) return bundles.ja;
  if (normalizedLocale?.startsWith("pt")) return bundles.pt;
  if (normalizedLocale?.startsWith("vi")) return bundles.vi;
  if (normalizedLocale === "zh-tw") return bundles.zhTW;

  return bundles.en;
}

export function getWorkspaceInvitationEmailCopy(locale?: string | null) {
  return getBundle(locale).invitations.email;
}

export function getInvitationRoleLabel(locale: string | null, role: string) {
  const labels: Record<string, string> = getBundle(locale).team.roles;

  return role
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => (Object.hasOwn(labels, name) ? labels[name] : name))
    .join(", ");
}
