import { useTranslation } from "react-i18next";
import { ConnectFieldRow } from "@/components/import/connect-forms/connect-field-row";
import type { ConnectFormProps } from "@/components/import/connect-forms/connect-form-props";
import { ExternalLinkButton } from "@/components/import/connect-forms/external-link-button";
import { fieldDescribedBy } from "@/components/import/connect-forms/field-ids";
import { SecretInput } from "@/components/import/connect-forms/secret-input";
import { TrelloLogo } from "@/components/import/source-logos/trello-logo";
import { trelloAuthorizeUrl as buildTrelloAuthorizeUrl } from "@/components/import/trello-authorize-url";
import { Input } from "@/components/ui/input";

const API_KEY_ID = "import-trello-api-key";
const AUTHORIZE_ID = "import-trello-authorize";
const TOKEN_ID = "import-trello-token";
const POWER_UPS_URL = "https://trello.com/power-ups/admin";

export function TrelloConnectForm({
  values,
  onChange,
  error,
  trelloAuthorizeUrl,
}: ConnectFormProps) {
  const { t } = useTranslation();
  const needsApiKey = trelloAuthorizeUrl === null;
  const authorizeUrl = needsApiKey
    ? buildTrelloAuthorizeUrl(values.apiKey)
    : trelloAuthorizeUrl;
  const tokenLabel = t("settings:workspaceImport.trello.tokenLabel");

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {needsApiKey ? (
        <ConnectFieldRow
          id={API_KEY_ID}
          labelFor={API_KEY_ID}
          label={t("settings:workspaceImport.trello.apiKeyLabel")}
          description={
            <>
              {t("settings:workspaceImport.trello.apiKeyDescription")}{" "}
              <a
                href={POWER_UPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                trello.com/power-ups/admin
                <span className="sr-only">
                  {" "}
                  {t("settings:workspaceImport.opensInNewTab")}
                </span>
              </a>
            </>
          }
        >
          <Input
            id={API_KEY_ID}
            value={values.apiKey}
            onChange={(event) => onChange({ apiKey: event.target.value })}
            placeholder={t("settings:workspaceImport.trello.apiKeyPlaceholder")}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={fieldDescribedBy(API_KEY_ID, false)}
          />
        </ConnectFieldRow>
      ) : null}
      <ConnectFieldRow
        id={AUTHORIZE_ID}
        label={t("settings:workspaceImport.trello.authorizeLabel")}
        description={
          needsApiKey && !authorizeUrl
            ? t("settings:workspaceImport.trello.authorizeNeedsKey")
            : t("settings:workspaceImport.trello.authorizeDescription")
        }
      >
        <ExternalLinkButton
          href={authorizeUrl}
          size="default"
          className="w-full"
        >
          <TrelloLogo size="sm" />
          {t("settings:workspaceImport.trello.authorizeButton")}
        </ExternalLinkButton>
      </ConnectFieldRow>
      <ConnectFieldRow
        id={TOKEN_ID}
        labelFor={TOKEN_ID}
        label={tokenLabel}
        description={t("settings:workspaceImport.trello.tokenDescription")}
        error={error}
      >
        <SecretInput
          id={TOKEN_ID}
          label={tokenLabel}
          value={values.token}
          onValueChange={(token) => onChange({ token })}
          placeholder={t("settings:workspaceImport.trello.tokenPlaceholder")}
          invalid={Boolean(error)}
        />
      </ConnectFieldRow>
    </div>
  );
}
