import { User, Users } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_USAGE_OPTIONS,
  type WorkspaceUsage,
} from "@/constants/onboarding";
import { cn } from "@/lib/cn";
import { OptionCard } from "./option-card";

const usageIcons = { team: Users, solo: User };

type UsageStepProps = {
  value: WorkspaceUsage;
  onChange: (value: WorkspaceUsage) => void;
  onContinue: () => void;
};

export function UsageStep({ value, onChange, onContinue }: UsageStepProps) {
  const { t } = useTranslation();
  const name = useId();

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">
          {t("auth:onboarding.cloud.usageLabel")}
        </legend>
        {WORKSPACE_USAGE_OPTIONS.map((option) => {
          const Icon = usageIcons[option.value];
          const checked = value === option.value;
          return (
            <OptionCard
              key={option.value}
              name={name}
              checked={checked}
              onSelect={() => onChange(option.value)}
              title={t(option.labelKey)}
              description={t(option.hintKey)}
              leading={
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4.5 shrink-0",
                    checked ? "text-foreground" : "text-muted-foreground",
                  )}
                />
              }
            />
          );
        })}
      </fieldset>
      <Button type="submit" size="lg" className="self-start">
        {t("auth:onboarding.continue")}
      </Button>
    </form>
  );
}
