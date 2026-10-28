import { useTranslation } from "react-i18next";
import { ConnectFieldRow } from "@/components/import/connect-forms/connect-field-row";
import type { ConnectFormProps } from "@/components/import/connect-forms/connect-form-props";
import { fieldDescribedBy } from "@/components/import/connect-forms/field-ids";
import { SecretInput } from "@/components/import/connect-forms/secret-input";
import { Input } from "@/components/ui/input";

const URL_ID = "import-kaneo-url";
const API_KEY_ID = "import-kaneo-api-key";

export function KaneoConnectForm({
  values,
  onChange,
  error,
}: ConnectFormProps) {
  const { t } = useTranslation();
  const apiKeyLabel = t("settings:workspaceImport.kaneo.apiKeyLabel");

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <ConnectFieldRow
        id={URL_ID}
        labelFor={URL_ID}
        label={t("settings:workspaceImport.kaneo.urlLabel")}
        description={t("settings:workspaceImport.kaneo.urlDescription")}
      >
        <Input
          id={URL_ID}
          type="url"
          inputMode="url"
          value={values.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder="https://cloud.kaneo.app"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={fieldDescribedBy(URL_ID, false)}
        />
      </ConnectFieldRow>
      <ConnectFieldRow
        id={API_KEY_ID}
        labelFor={API_KEY_ID}
        label={apiKeyLabel}
        description={t("settings:workspaceImport.kaneo.apiKeyDescription")}
        error={error}
      >
        <SecretInput
          id={API_KEY_ID}
          label={apiKeyLabel}
          value={values.apiKey}
          onValueChange={(apiKey) => onChange({ apiKey })}
          placeholder={t("settings:workspaceImport.kaneo.apiKeyPlaceholder")}
          invalid={Boolean(error)}
        />
      </ConnectFieldRow>
    </div>
  );
}
