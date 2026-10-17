import { useTranslation } from "react-i18next";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { ProjectScopeLink } from "./project-scope-link";
import { type ProjectView, tasksViewFor } from "./project-views";

type ProjectScopeToggleProps = {
  workspaceId: string;
  projectId: string;
  currentView: ProjectView;
  onSelect: (view: ProjectView) => void;
};

export function ProjectScopeToggle({
  workspaceId,
  projectId,
  currentView,
  onSelect,
}: ProjectScopeToggleProps) {
  const { t } = useTranslation();
  const taskLayout = useUserPreferencesStore((state) => state.taskLayout);
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  const onBacklog = currentView === "backlog";
  const tasksView = onBacklog
    ? tasksViewFor(taskLayout, viewMode)
    : currentView;

  return (
    <nav
      aria-label={t("tasks:view.heading")}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 dark:bg-input/32"
    >
      <ProjectScopeLink
        view={tasksView}
        workspaceId={workspaceId}
        projectId={projectId}
        active={!onBacklog}
        onSelect={onSelect}
      >
        {t("tasks:title")}
      </ProjectScopeLink>
      <ProjectScopeLink
        view="backlog"
        workspaceId={workspaceId}
        projectId={projectId}
        active={onBacklog}
        onSelect={onSelect}
      >
        {t("tasks:view.backlog")}
      </ProjectScopeLink>
    </nav>
  );
}
