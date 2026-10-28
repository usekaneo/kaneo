import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, type ButtonProps } from "@/components/ui/button";

type ExternalLinkButtonProps = {
  href: string | null;
  size?: ButtonProps["size"];
  className?: string;
  children: ReactNode;
};

export function ExternalLinkButton({
  href,
  size = "sm",
  className,
  children,
}: ExternalLinkButtonProps) {
  const { t } = useTranslation();
  const content = (
    <>
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5" />
      <span className="sr-only">
        {t("settings:workspaceImport.opensInNewTab")}
      </span>
    </>
  );

  if (!href) {
    return (
      <Button variant="outline" size={size} className={className} disabled>
        {content}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      {content}
    </Button>
  );
}
