import { useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { ProjectDangerZone } from "@/components/settings/project-general/project-danger-zone";
import { ProjectDetailsSection } from "@/components/settings/project-general/project-details-section";
import { ProjectTasksSection } from "@/components/settings/project-general/project-tasks-section";
import { useProjectAutosave } from "@/components/settings/project-general/use-project-autosave";
import { SettingsPage } from "@/components/settings/settings-page";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import useProjectStore from "@/store/project";

export function ProjectGeneralPage() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { projectId: rawProjectId } = useParams({ strict: false });
  const projectId = rawProjectId ?? "";
  const { data: fetchedProject } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const isCurrentProject = project?.id === projectId;
  const { canManageProjects, canDeleteProjects } = useWorkspacePermission();
  const canEdit = canManageProjects();
  const canDelete = canDeleteProjects();
  const { form, flushPendingSave } = useProjectAutosave({
    project,
    workspaceId: workspace?.id,
    canEdit,
  });

  useEffect(() => {
    if (fetchedProject) {
      setProject(fetchedProject);
    }
  }, [fetchedProject, setProject]);

  return (
    <>
      <PageTitle title={t("settings:projectGeneral.pageTitle")} />
      <SettingsPage
        title={t("settings:projectGeneral.title")}
        description={
          isCurrentProject && project?.name
            ? t("settings:projectGeneral.subtitle", { name: project.name })
            : undefined
        }
        actions={canEdit ? <AutosaveNote /> : undefined}
      >
        <ProjectDetailsSection
          form={form}
          project={project}
          canEdit={canEdit}
        />
        {project ? (
          <ProjectTasksSection
            project={project}
            isCurrentProject={isCurrentProject}
            flushPendingSave={flushPendingSave}
          />
        ) : null}
        {canDelete ? (
          <ProjectDangerZone
            project={project}
            isCurrentProject={isCurrentProject}
            workspaceId={workspace?.id}
          />
        ) : null}
      </SettingsPage>
    </>
  );
}
