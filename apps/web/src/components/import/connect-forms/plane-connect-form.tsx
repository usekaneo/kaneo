import { useTranslation } from "react-i18next";
import { ConnectFieldRow } from "@/components/import/connect-forms/connect-field-row";
import type { ConnectFormProps } from "@/components/import/connect-forms/connect-form-props";
import { fieldDescribedBy } from "@/components/import/connect-forms/field-ids";
import { SecretInput } from "@/components/import/connect-forms/secret-input";
import { Input } from "@/components/ui/input";

const URL_ID = "import-plane-url";
const TOKEN_ID = "import-plane-token";

export function PlaneConnectForm({
  values,
  onChange,
  error,
}: ConnectFormProps) {
  const { t } = useTranslation();
  const tokenLabel = t("settings:workspaceImport.plane.tokenLabel");

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <ConnectFieldRow
        id={URL_ID}
        labelFor={URL_ID}
        label={t("settings:workspaceImport.plane.urlLabel")}
        description={t("settings:workspaceImport.plane.urlDescription")}
      >
        <Input
          id={URL_ID}
          type="url"
          inputMode="url"
          value={values.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder={t("settings:workspaceImport.plane.urlPlaceholder")}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={fieldDescribedBy(URL_ID, false)}
        />
      </ConnectFieldRow>
      <ConnectFieldRow
        id={TOKEN_ID}
        labelFor={TOKEN_ID}
        label={tokenLabel}
        description={t("settings:workspaceImport.plane.tokenDescription")}
        error={error}
      >
        <SecretInput
          id={TOKEN_ID}
          label={tokenLabel}
          value={values.apiKey}
          onValueChange={(apiKey) => onChange({ apiKey })}
          placeholder="plane_api_..."
          invalid={Boolean(error)}
        />
      </ConnectFieldRow>
    </div>
  );
}
