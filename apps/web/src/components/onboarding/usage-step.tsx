import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  WORKSPACE_USAGE_OPTIONS,
  type WorkspaceUsage,
} from "@/constants/onboarding";
import { OptionCard } from "./option-card";
import { UsageAvatars } from "./usage-avatars";

type UsageStepProps = {
  value: WorkspaceUsage;
  ownerInitial: string;
  onChange: (value: WorkspaceUsage) => void;
  onContinue: () => void;
};

export function UsageStep({
  value,
  ownerInitial,
  onChange,
  onContinue,
}: UsageStepProps) {
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
        {WORKSPACE_USAGE_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            name={name}
            checked={value === option.value}
            onSelect={() => onChange(option.value)}
            title={t(option.labelKey)}
            description={t(option.hintKey)}
            leading={
              <UsageAvatars
                initial={ownerInitial}
                team={option.value === "team"}
              />
            }
          />
        ))}
      </fieldset>
      <Button type="submit" size="lg" className="self-start">
        {t("auth:onboarding.continue")}
      </Button>
    </form>
  );
}
