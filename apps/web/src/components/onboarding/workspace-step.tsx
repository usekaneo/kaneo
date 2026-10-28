import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authMessageClassName } from "@/components/auth/auth-form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkspaceStepProps = {
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
};

export function WorkspaceStep({
  value,
  onChange,
  onContinue,
}: WorkspaceStepProps) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);

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
        <Label htmlFor="onboarding-workspace-name">
          {t("auth:onboarding.workspaceName")}
        </Label>
        <Input
          id="onboarding-workspace-name"
          size="lg"
          autoFocus
          autoComplete="organization"
          value={value}
          placeholder={t("auth:onboarding.workspaceNamePlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? "onboarding-workspace-name-error" : undefined
          }
          onChange={(event) => {
            onChange(event.target.value);
            setError(false);
          }}
        />
        {error ? (
          <p
            id="onboarding-workspace-name-error"
            role="alert"
            className={authMessageClassName}
          >
            {t("auth:onboarding.validation.workspaceNameRequired")}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="self-start">
        {t("auth:onboarding.continue")}
      </Button>
    </form>
  );
}
