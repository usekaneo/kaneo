import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkspaceRuleProjectList } from "./workspace-rule-project-list";
import type { WorkspaceRuleState } from "./workspace-rule-state";

type WorkspaceRuleProjectsProps = {
  workspaceId: string;
  disabled: boolean;
  projectMode: WorkspaceRuleState["projectMode"];
  selectedProjectIds: string[];
  onModeChange: (mode: WorkspaceRuleState["projectMode"]) => void;
  onToggleProject: (projectId: string, checked: boolean) => void;
};

const segmentClassName =
  "h-7 flex-1 rounded-md px-3 text-[13px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground data-pressed:bg-background data-pressed:font-medium data-pressed:text-foreground data-pressed:shadow-xs/5 dark:data-pressed:bg-input sm:h-7";

export function WorkspaceRuleProjects({
  workspaceId,
  disabled,
  projectMode,
  selectedProjectIds,
  onModeChange,
  onToggleProject,
}: WorkspaceRuleProjectsProps) {
  const { t } = useTranslation();
  const headingId = useId();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id={headingId}>
        {t("settings:notificationsPage.ruleProjects")}
      </p>
      <ToggleGroup
        aria-labelledby={headingId}
        className="w-full rounded-lg border border-input bg-muted/40 p-0.5"
        disabled={disabled}
        onValueChange={(values) => {
          const next = values[0];
          if (next === "all" || next === "selected") onModeChange(next);
        }}
        size="sm"
        value={[projectMode]}
      >
        <ToggleGroupItem className={segmentClassName} value="all">
          {t("settings:notificationsPage.allProjects")}
        </ToggleGroupItem>
        <ToggleGroupItem className={segmentClassName} value="selected">
          {t("settings:notificationsPage.someProjects")}
        </ToggleGroupItem>
      </ToggleGroup>
      {projectMode === "selected" ? (
        <WorkspaceRuleProjectList
          disabled={disabled}
          onToggle={onToggleProject}
          selectedProjectIds={selectedProjectIds}
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}
