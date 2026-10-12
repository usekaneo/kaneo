import { useTranslation } from "react-i18next";
import { ExportTasksRow } from "@/components/project/tasks-import-export/export-tasks-row";
import { ImportTasksRow } from "@/components/project/tasks-import-export/import-tasks-row";
import { MoveProjectRow } from "@/components/settings/project-general/move-project-row";
import { useProjectMoveTargets } from "@/components/settings/project-general/use-project-move-targets";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { ProjectWithTasks } from "@/types/project";

type ProjectTasksSectionProps = {
  project: ProjectWithTasks;
  isCurrentProject: boolean;
  flushPendingSave: () => Promise<boolean>;
};

export function ProjectTasksSection({
  project,
  isCurrentProject,
  flushPendingSave,
}: ProjectTasksSectionProps) {
  const { t } = useTranslation();
  const { moveTargets, moveTargetsFailed, canShowMove } = useProjectMoveTargets(
    project,
    isCurrentProject,
  );

  return (
    <SettingsSection title={t("settings:projectGeneral.tasksTitle")}>
      <SettingsCard>
        <ExportTasksRow project={project} />
        <ImportTasksRow project={project} />
        {canShowMove ? (
          <MoveProjectRow
            projectId={project.id}
            targets={moveTargets}
            targetsFailed={moveTargetsFailed}
            flushPendingSave={flushPendingSave}
          />
        ) : null}
      </SettingsCard>
    </SettingsSection>
  );
}
