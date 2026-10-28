import { useTranslation } from "react-i18next";
import { AutomationFieldError } from "./automation-field-error";

type AutomationNameFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  error: string | undefined;
};

// The name doubles as the page heading, like the design's large title.
export function AutomationNameField({
  value,
  onValueChange,
  error,
}: AutomationNameFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <input
        aria-label={t("agent:automations.form.name")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "automation-name-error" : undefined}
        value={value}
        maxLength={200}
        placeholder={t("agent:automations.form.namePlaceholder")}
        onChange={(event) => onValueChange(event.target.value)}
        className="w-full bg-transparent font-semibold text-2xl text-foreground tracking-tight outline-none placeholder:text-muted-foreground/60"
      />
      <AutomationFieldError id="automation-name-error" error={error} />
    </div>
  );
}
