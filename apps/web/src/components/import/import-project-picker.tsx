import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ImportSourceDefinition } from "@/components/import/import-source-definitions";
import { ImportOptionsCard } from "@/components/import/import-options-card";
import { ImportProjectOption } from "@/components/import/import-project-option";
import { ImportStepLayout } from "@/components/import/import-step-layout";
import { IMPORT_UNIT_COPY } from "@/components/import/import-unit-copy";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import type { ImportSourceProject } from "@/fetchers/import/list-import-source-projects";

const MAX_IMPORT_PROJECTS = 50;

export type ImportProjectSelection = {
  projectIds: string[];
  includeComments: boolean;
};

type ImportProjectPickerProps = {
  source: ImportSourceDefinition;
  workspaceId: string;
  workspaceName: string;
  projects: ImportSourceProject[];
  error: string | null;
  isStarting: boolean;
  onBack: () => void;
  onStart: (selection: ImportProjectSelection) => void;
};

export function ImportProjectPicker({
  source,
  workspaceId,
  workspaceName,
  projects,
  error,
  isStarting,
  onBack,
  onStart,
}: ImportProjectPickerProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [includeComments, setIncludeComments] = useState(true);
  const copy = IMPORT_UNIT_COPY[source.unit];
  const sectionTitle = t(copy.section);
  const allSelected =
    projects.length > 0 && selected.length === projects.length;
  const overLimit = selected.length > MAX_IMPORT_PROJECTS;

  const toggleAll = () =>
    setSelected(allSelected ? [] : projects.map((project) => project.id));

  return (
    <ImportStepLayout
      source={source}
      backLabel={t("settings:workspaceImport.back.changeKey")}
      onBack={onBack}
      current={2}
      title={t("settings:workspaceImport.connect.title", {
        source: source.name,
      })}
      description={t(copy.pick)}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected.length === 0 || overLimit) return;
          onStart({ projectIds: selected, includeComments });
        }}
      >
        <SettingsSectionHeader
          title={sectionTitle}
          description={t(copy.found, {
            count: projects.length,
            workspace: workspaceName,
          })}
          action={
            projects.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected
                  ? t("settings:workspaceImport.select.clear")
                  : t("settings:workspaceImport.select.selectAll")}
              </Button>
            ) : null
          }
        />
        {projects.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-muted-foreground text-sm">
            {t(copy.empty)}
          </div>
        ) : (
          <>
            <CheckboxGroup
              aria-label={sectionTitle}
              value={selected}
              onValueChange={setSelected}
              className="items-stretch gap-0 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
            >
              {projects.map((project) => (
                <ImportProjectOption key={project.id} project={project} />
              ))}
            </CheckboxGroup>
            <ImportOptionsCard
              sourceId={source.id}
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              includeComments={includeComments}
              onIncludeCommentsChange={setIncludeComments}
            />
          </>
        )}
        {error ? (
          <Alert variant="error">
            <CircleAlert aria-hidden="true" />
            <AlertDescription className="text-foreground">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {overLimit ? (
            <p className="me-auto text-destructive-foreground text-xs">
              {t(copy.limit, { max: MAX_IMPORT_PROJECTS })}
            </p>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onBack}>
            {t("settings:workspaceImport.select.back")}
          </Button>
          {projects.length > 0 ? (
            <Button
              type="submit"
              size="sm"
              loading={isStarting}
              disabled={selected.length === 0 || overLimit}
            >
              {t(copy.importButton, { count: selected.length })}
            </Button>
          ) : null}
        </div>
      </form>
    </ImportStepLayout>
  );
}
