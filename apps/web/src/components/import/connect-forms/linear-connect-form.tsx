import { useTranslation } from "react-i18next";
import { ConnectFieldRow } from "@/components/import/connect-forms/connect-field-row";
import type { ConnectFormProps } from "@/components/import/connect-forms/connect-form-props";
import { ConnectHelpSteps } from "@/components/import/connect-forms/connect-help-steps";
import { SecretInput } from "@/components/import/connect-forms/secret-input";

const API_KEY_ID = "import-linear-api-key";

export function LinearConnectForm({
  values,
  onChange,
  error,
}: ConnectFormProps) {
  const { t } = useTranslation();
  const label = t("settings:workspaceImport.linear.apiKeyLabel");

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <ConnectFieldRow
        id={API_KEY_ID}
        labelFor={API_KEY_ID}
        label={label}
        description={t("settings:workspaceImport.linear.apiKeyDescription")}
        error={error}
      >
        <SecretInput
          id={API_KEY_ID}
          label={label}
          value={values.apiKey}
          onValueChange={(apiKey) => onChange({ apiKey })}
          placeholder="lin_api_..."
          invalid={Boolean(error)}
        />
      </ConnectFieldRow>
      <ConnectHelpSteps
        href="https://linear.app/settings/account/security"
        linkLabel={t("settings:workspaceImport.linear.openSettings")}
        steps={[
          t("settings:workspaceImport.linear.stepOpen"),
          t("settings:workspaceImport.linear.stepCreate"),
          t("settings:workspaceImport.linear.stepPaste"),
        ]}
      />
    </div>
  );
}
