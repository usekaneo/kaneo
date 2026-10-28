import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { AccessVerificationLine } from "@/components/project/code-hosting/access-verification-line";
import type { AccessVerificationResult } from "@/components/project/code-hosting/access-verification-tone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChangeTokenFormProps = {
  token: string;
  tokenLabel: string;
  placeholder: string;
  fallbackError: string;
  extra?: ReactNode;
  verification: {
    checking: boolean;
    result: AccessVerificationResult | undefined;
    error: unknown;
  };
  saving: boolean;
  canSave: boolean;
  onTokenChange: (token: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ChangeTokenForm({
  token,
  tokenLabel,
  placeholder,
  fallbackError,
  extra,
  verification,
  saving,
  canSave,
  onTokenChange,
  onSave,
  onCancel,
}: ChangeTokenFormProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="space-y-2">
      {extra}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          aria-label={tokenLabel}
          placeholder={placeholder}
          value={token}
          disabled={saving}
          className="min-w-0 flex-1"
          onChange={(event) => onTokenChange(event.target.value)}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onCancel}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!canSave}
            onClick={onSave}
          >
            {t("settings:codeHosting.saveToken")}
          </Button>
        </div>
      </div>
      {token.trim() ? (
        <AccessVerificationLine
          {...verification}
          fallbackError={fallbackError}
        />
      ) : null}
    </div>
  );
}
