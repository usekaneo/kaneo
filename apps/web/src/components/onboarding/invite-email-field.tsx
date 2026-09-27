import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InviteEmailFieldProps = {
  id: string;
  position: number;
  value: string;
  invalid: boolean;
  autoFocus: boolean;
  removable: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
};

export function InviteEmailField({
  id,
  position,
  value,
  invalid,
  autoFocus,
  removable,
  disabled,
  onChange,
  onRemove,
}: InviteEmailFieldProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="sr-only">
        {t("auth:onboarding.cloud.invite.emailLabel", { index: position })}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="email"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={t("auth:onboarding.cloud.invite.emailPlaceholder")}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {removable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={disabled}
            aria-label={t("auth:onboarding.cloud.invite.remove", {
              index: position,
            })}
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <p id={errorId} className="text-xs text-destructive">
          {t("auth:onboarding.cloud.invite.invalidEmail")}
        </p>
      ) : null}
    </div>
  );
}
