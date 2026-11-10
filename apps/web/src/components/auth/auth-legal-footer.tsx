import { useTranslation } from "react-i18next";
import useGetConfig from "@/hooks/queries/config/use-get-config";

const links = [
  { href: "/terms/", labelKey: "auth:page.terms" },
  {
    href: "/privacy/",
    labelKey: "auth:page.privacy",
  },
] as const;

const linkClassName = "transition-colors hover:text-foreground";

export function AuthLegalFooter() {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();

  if (!config) return null;

  return (
    <footer className="flex justify-center gap-5 px-6 pb-8 text-muted-foreground text-xs">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {t(link.labelKey)}
        </a>
      ))}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        {config.instanceName}
      </a>
    </footer>
  );
}
