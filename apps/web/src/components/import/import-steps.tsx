import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  IMPORT_UNIT_COPY,
  type ImportUnit,
} from "@/components/import/import-unit-copy";
import { cn } from "@/lib/cn";

export type ImportStepNumber = 1 | 2 | 3;

type ImportStepsProps = {
  current: ImportStepNumber;
  complete?: boolean;
  unit: ImportUnit;
};

export function ImportSteps({
  current,
  complete = false,
  unit,
}: ImportStepsProps) {
  const { t } = useTranslation();
  const labels = [
    t("settings:workspaceImport.steps.connect"),
    t(IMPORT_UNIT_COPY[unit].step),
    t("settings:workspaceImport.steps.import"),
  ];

  return (
    <ol
      aria-label={t("settings:workspaceImport.steps.label")}
      className="flex items-center gap-2"
    >
      {labels.map((label, index) => {
        const step = index + 1;
        const done = complete || step < current;
        const active = !done && step === current;

        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {index > 0 ? (
              <span aria-hidden="true" className="h-px w-3 bg-border" />
            ) : null}
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full font-medium text-[10px] tabular-nums",
                  done &&
                    "bg-success/8 text-success-foreground dark:bg-success/16",
                  active && "bg-primary text-primary-foreground",
                  !done &&
                    !active &&
                    "border border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-2.5" strokeWidth={3} /> : step}
              </span>
              <span
                className={cn(
                  "text-xs",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground max-sm:sr-only",
                )}
              >
                {label}
                {done ? (
                  <span className="sr-only">
                    {" "}
                    {t("settings:workspaceImport.steps.done")}
                  </span>
                ) : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
