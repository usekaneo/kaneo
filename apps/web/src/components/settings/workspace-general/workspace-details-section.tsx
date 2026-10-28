import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsFormRow } from "@/components/settings/settings-form-row";
import { SettingsSection } from "@/components/settings/settings-section";
import type { WorkspaceFormValues } from "@/components/settings/workspace-general/workspace-form-values";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type WorkspaceDetailsSectionProps = {
  form: UseFormReturn<WorkspaceFormValues>;
  canEdit: boolean;
};

export function WorkspaceDetailsSection({
  form,
  canEdit,
}: WorkspaceDetailsSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t("settings:workspaceGeneral.workspaceInfoTitle")}>
      <Form {...form}>
        <form onSubmit={(event) => event.preventDefault()}>
          <SettingsCard>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <SettingsFormRow
                  label={t("settings:workspaceGeneral.nameLabel")}
                >
                  <Input
                    size="sm"
                    className="sm:w-64"
                    placeholder={t("settings:workspaceGeneral.namePlaceholder")}
                    disabled={!canEdit}
                    {...field}
                  />
                </SettingsFormRow>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <SettingsFormRow
                  label={t("settings:workspaceGeneral.descriptionLabel")}
                >
                  <Input
                    size="sm"
                    className="sm:w-64"
                    placeholder={t(
                      "settings:workspaceGeneral.descriptionPlaceholder",
                    )}
                    disabled={!canEdit}
                    {...field}
                  />
                </SettingsFormRow>
              )}
            />
          </SettingsCard>
        </form>
      </Form>
    </SettingsSection>
  );
}
