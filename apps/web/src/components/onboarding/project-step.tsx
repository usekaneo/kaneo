import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authMessageClassName } from "@/components/auth/auth-form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProjectStepProps = {
  value: string;
  projectKey: string;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onContinue: () => void;
};

export function ProjectStep({
  value,
  projectKey,
  isSubmitting,
  onChange,
  onContinue,
}: ProjectStepProps) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const ticket =
    "flex h-5 items-center rounded-md border border-input bg-background px-1.5 font-mono text-[11px] text-foreground dark:bg-input/32";

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) {
          setError(true);
          return;
        }
        onContinue();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="onboarding-project-name">
          {t("auth:onboarding.project.label")}
        </Label>
        <Input
          id="onboarding-project-name"
          size="lg"
          autoFocus
          value={value}
          disabled={isSubmitting}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? "onboarding-project-name-error" : "onboarding-project-key"
          }
          onChange={(event) => {
            onChange(event.target.value);
            setError(false);
          }}
        />
        {error ? (
          <p
            id="onboarding-project-name-error"
            role="alert"
            className={authMessageClassName}
          >
            {t("auth:onboarding.validation.projectNameRequired")}
          </p>
        ) : (
          <p
            id="onboarding-project-key"
            className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            {t("auth:onboarding.project.numbered")}
            <span className={ticket}>{projectKey}-1</span>
            <span className={ticket}>{projectKey}-2</span>
            <span aria-hidden="true">…</span>
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        className="self-start"
        loading={isSubmitting}
      >
        {t("auth:onboarding.continue")}
      </Button>
    </form>
  );
}
