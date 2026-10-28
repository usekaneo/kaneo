import { useTranslation } from "react-i18next";
import { ProjectScopeLink } from "./project-scope-link";
import type { ProjectView } from "./project-views";

type ProjectScopeToggleProps = {
  workspaceId: string;
  projectId: string;
  currentView: ProjectView;
  tasksView: ProjectView;
  onSelect: (view: ProjectView) => void;
};

export function ProjectScopeToggle({
  workspaceId,
  projectId,
  currentView,
  tasksView,
  onSelect,
}: ProjectScopeToggleProps) {
  const { t } = useTranslation();
  const onBacklog = currentView === "backlog";

  return (
    <nav
      aria-label={t("tasks:view.heading")}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 dark:bg-input/32"
    >
      <ProjectScopeLink
        view={onBacklog ? tasksView : currentView}
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
