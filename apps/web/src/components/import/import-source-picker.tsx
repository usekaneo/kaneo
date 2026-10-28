import { useTranslation } from "react-i18next";
import { IMPORT_SOURCES } from "@/components/import/import-source-definitions";
import { ImportSourceRow } from "@/components/import/import-source-row";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

export function ImportSourcePicker() {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <SettingsSectionHeader
        title={t("settings:workspaceImport.sources.title")}
        description={t("settings:workspaceImport.sources.description")}
      />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {IMPORT_SOURCES.map((source) => (
          <ImportSourceRow key={source.id} source={source} />
        ))}
      </ul>
    </section>
  );
}
