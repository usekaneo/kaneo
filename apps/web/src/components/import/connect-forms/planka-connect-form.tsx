import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConnectFieldRow } from "@/components/import/connect-forms/connect-field-row";
import type { ConnectFormProps } from "@/components/import/connect-forms/connect-form-props";
import { fieldDescribedBy } from "@/components/import/connect-forms/field-ids";
import { SecretInput } from "@/components/import/connect-forms/secret-input";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const URL_ID = "import-planka-url";
const SIGN_IN_ID = "import-planka-sign-in";
const API_KEY_ID = "import-planka-api-key";
const USERNAME_ID = "import-planka-username";
const PASSWORD_ID = "import-planka-password";

export function PlankaConnectForm({
  values,
  onChange,
  error,
}: ConnectFormProps) {
  const { t } = useTranslation();
  const apiKeyLabel = t("settings:workspaceImport.planka.apiKeyLabel");
  const passwordLabel = t("settings:workspaceImport.planka.passwordLabel");

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <ConnectFieldRow
        id={URL_ID}
        labelFor={URL_ID}
        label={t("settings:workspaceImport.planka.urlLabel")}
        description={t("settings:workspaceImport.planka.urlDescription")}
      >
        <Input
          id={URL_ID}
          type="url"
          inputMode="url"
          value={values.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder="https://planka.example.com"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={fieldDescribedBy(URL_ID, false)}
        />
      </ConnectFieldRow>
      <ConnectFieldRow
        id={SIGN_IN_ID}
        label={t("settings:workspaceImport.planka.signInLabel")}
        description={t("settings:workspaceImport.planka.signInDescription")}
      >
        <ToggleGroup
          aria-labelledby={`${SIGN_IN_ID}-label`}
          aria-describedby={fieldDescribedBy(SIGN_IN_ID, false)}
          value={[values.plankaSignIn]}
          onValueChange={([next]) => {
            if (next === "apiKey" || next === "password") {
              onChange({ plankaSignIn: next });
            }
          }}
          className="h-9 w-full rounded-lg border border-input bg-background p-0.5 sm:h-8 dark:bg-input/32"
        >
          <ToggleGroupItem
            value="apiKey"
            size="sm"
            className="h-full flex-1 sm:h-full"
          >
            {t("settings:workspaceImport.planka.signInApiKey")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="password"
            size="sm"
            className="h-full flex-1 sm:h-full"
          >
            {t("settings:workspaceImport.planka.signInPassword")}
          </ToggleGroupItem>
        </ToggleGroup>
      </ConnectFieldRow>
      {values.plankaSignIn === "apiKey" ? (
        <ConnectFieldRow
          id={API_KEY_ID}
          labelFor={API_KEY_ID}
          label={apiKeyLabel}
          description={t("settings:workspaceImport.planka.apiKeyDescription")}
          error={error}
        >
          <SecretInput
            id={API_KEY_ID}
            label={apiKeyLabel}
            value={values.apiKey}
            onValueChange={(apiKey) => onChange({ apiKey })}
            placeholder={t("settings:workspaceImport.planka.apiKeyPlaceholder")}
            invalid={Boolean(error)}
          />
        </ConnectFieldRow>
      ) : (
        <>
          <ConnectFieldRow
            id={USERNAME_ID}
            labelFor={USERNAME_ID}
            label={t("settings:workspaceImport.planka.usernameLabel")}
            description={t(
              "settings:workspaceImport.planka.usernameDescription",
            )}
          >
            <Input
              id={USERNAME_ID}
              value={values.username}
              onChange={(event) => onChange({ username: event.target.value })}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby={fieldDescribedBy(USERNAME_ID, false)}
            />
          </ConnectFieldRow>
          <ConnectFieldRow
            id={PASSWORD_ID}
            labelFor={PASSWORD_ID}
            label={passwordLabel}
            description={t(
              "settings:workspaceImport.planka.passwordDescription",
            )}
            error={error}
          >
            <SecretInput
              id={PASSWORD_ID}
              label={passwordLabel}
              value={values.password}
              onValueChange={(password) => onChange({ password })}
              invalid={Boolean(error)}
            />
          </ConnectFieldRow>
        </>
      )}
      <div className="flex items-start gap-2.5 bg-info/4 px-4 py-3 text-xs dark:bg-info/8">
        <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-info" />
        <p>{t("settings:workspaceImport.planka.adminTip")}</p>
      </div>
    </div>
  );
}
