import { useTranslation } from "react-i18next";
import { ExternalLinkButton } from "@/components/import/connect-forms/external-link-button";

type ConnectHelpStepsProps = {
  steps: string[];
  href: string;
  linkLabel: string;
};

export function ConnectHelpSteps({
  steps,
  href,
  linkLabel,
}: ConnectHelpStepsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-xs">
          {t("settings:workspaceImport.connect.whereToFind")}
        </p>
        <ExternalLinkButton href={href}>{linkLabel}</ExternalLinkButton>
      </div>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex items-start gap-2.5 text-muted-foreground text-xs"
          >
            <span
              aria-hidden="true"
              className="flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border border-border font-medium text-[10px] tabular-nums"
            >
              {index + 1}
            </span>
            <span className="pt-px">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
