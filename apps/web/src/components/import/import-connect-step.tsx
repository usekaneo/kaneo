import { useTranslation } from "react-i18next";
import { CONNECT_FORMS } from "@/components/import/connect-forms/connect-form-registry";
import type { ImportConnectValues } from "@/components/import/connect-values";
import type { ImportSourceDefinition } from "@/components/import/import-source-definitions";
import { ImportStepLayout } from "@/components/import/import-step-layout";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Button } from "@/components/ui/button";

type ImportConnectStepProps = {
  source: ImportSourceDefinition;
  values: ImportConnectValues;
  onChange: (patch: Partial<ImportConnectValues>) => void;
  trelloAuthorizeUrl: string | null;
  error: string | null;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

export function ImportConnectStep({
  source,
  values,
  onChange,
  trelloAuthorizeUrl,
  error,
  canSubmit,
  isSubmitting,
  onSubmit,
  onCancel,
}: ImportConnectStepProps) {
  const { t } = useTranslation();
  const Form = CONNECT_FORMS[source.id];

  return (
    <ImportStepLayout
      source={source}
      backLabel={t("settings:workspaceImport.back.allSources")}
      onBack={onCancel}
      current={1}
      title={t("settings:workspaceImport.connect.title", {
        source: source.name,
      })}
      description={t(source.introKey)}
    >
      <form
        noValidate
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <SettingsSectionHeader
          title={t("settings:workspaceImport.connect.sectionTitle")}
          description={t(
            "settings:workspaceImport.connect.sectionDescription",
            {
              source: source.name,
            },
          )}
        />
        <Form
          values={values}
          onChange={onChange}
          error={error}
          trelloAuthorizeUrl={trelloAuthorizeUrl}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("settings:workspaceImport.connect.cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            {t("settings:workspaceImport.connect.continue")}
          </Button>
        </div>
      </form>
    </ImportStepLayout>
  );
}
