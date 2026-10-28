import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConnectFieldRow } from "@/components/import/connect-forms/connect-field-row";
import type { ConnectFormProps } from "@/components/import/connect-forms/connect-form-props";
import { ConnectHelpSteps } from "@/components/import/connect-forms/connect-help-steps";
import { fieldDescribedBy } from "@/components/import/connect-forms/field-ids";
import { SecretInput } from "@/components/import/connect-forms/secret-input";
import { Input } from "@/components/ui/input";

const URL_ID = "import-jira-url";
const EMAIL_ID = "import-jira-email";
const TOKEN_ID = "import-jira-token";

export function JiraConnectForm({ values, onChange, error }: ConnectFormProps) {
  const { t } = useTranslation();
  const tokenLabel = t("settings:workspaceImport.jira.tokenLabel");

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <ConnectFieldRow
        id={URL_ID}
        labelFor={URL_ID}
        label={t("settings:workspaceImport.jira.urlLabel")}
        description={t("settings:workspaceImport.jira.urlDescription")}
      >
        <Input
          id={URL_ID}
          type="url"
          inputMode="url"
          value={values.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder={t("settings:workspaceImport.jira.urlPlaceholder")}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={fieldDescribedBy(URL_ID, false)}
        />
      </ConnectFieldRow>
      <ConnectFieldRow
        id={EMAIL_ID}
        labelFor={EMAIL_ID}
        label={t("settings:workspaceImport.jira.emailLabel")}
        description={t("settings:workspaceImport.jira.emailDescription")}
      >
        <Input
          id={EMAIL_ID}
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(event) => onChange({ email: event.target.value })}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={fieldDescribedBy(EMAIL_ID, false)}
        />
      </ConnectFieldRow>
      <ConnectFieldRow
        id={TOKEN_ID}
        labelFor={TOKEN_ID}
        label={tokenLabel}
        description={t("settings:workspaceImport.jira.tokenDescription")}
        error={error}
      >
        <SecretInput
          id={TOKEN_ID}
          label={tokenLabel}
          value={values.token}
          onValueChange={(token) => onChange({ token })}
          placeholder={t("settings:workspaceImport.jira.tokenPlaceholder")}
          invalid={Boolean(error)}
        />
      </ConnectFieldRow>
      <ConnectHelpSteps
        href="https://id.atlassian.com/manage-profile/security/api-tokens"
        linkLabel={t("settings:workspaceImport.jira.openSettings")}
        steps={[
          t("settings:workspaceImport.jira.stepOpen"),
          t("settings:workspaceImport.jira.stepCreate"),
          t("settings:workspaceImport.jira.stepPaste"),
        ]}
      />
      <div className="flex items-start gap-2.5 bg-info/4 px-4 py-3 text-xs dark:bg-info/8">
        <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-info" />
        <p>{t("settings:workspaceImport.jira.nameMatchTip")}</p>
      </div>
    </div>
  );
}
