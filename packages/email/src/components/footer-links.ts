import { brandText } from "@kaneo/branding";
import type { EmailLocale } from "../templates/resolve-locale";
import type { FooterLink } from "./email-footer";

const labels: Record<EmailLocale, { help: string; privacy: string }> = {
  en: { help: "Help", privacy: "Privacy" },
  de: { help: "Hilfe", privacy: "Datenschutz" },
  vi: { help: "Trợ giúp", privacy: "Quyền riêng tư" },
  ja: { help: "ヘルプ", privacy: "プライバシー" },
  "zh-tw": { help: "說明", privacy: "隱私權" },
};

export function footerLinks(
  locale: EmailLocale,
  leading: FooterLink[] = [],
): FooterLink[] {
  const copy = labels[locale];

  return [
    ...leading,
    { label: brandText("kaneo.app"), href: brandText("https://kaneo.app") },
    { label: copy.help, href: brandText("https://kaneo.app/docs") },
    { label: copy.privacy, href: brandText("https://kaneo.app/privacy") },
  ];
}
