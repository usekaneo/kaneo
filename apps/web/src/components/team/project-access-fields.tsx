import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { type ProjectAccessValue } from "./project-access/project-access-value";
import { toggleProjectId } from "./project-access/toggle-project-id";

type Props = {
  value: ProjectAccessValue;
  onChange: (value: ProjectAccessValue) => void;
  projects:
    | readonly { id: string; name: string; archivedAt?: string | null }[]
    | undefined;
  isLoadingProjects?: boolean;
  disabled?: boolean;
  error?: string;
};

function ProjectAccessFields({
  value,
  onChange,
  projects,
  isLoadingProjects = false,
  disabled = false,
  error,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const headingId = `${id}-heading`;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p id={headingId} className="text-sm font-medium">
          {t("team:projectAccess.label")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("team:projectAccess.description")}
        </p>
      </div>

      <RadioGroup
        aria-labelledby={headingId}
        className="gap-2"
        disabled={disabled}
        value={value.projectAccess}
        onValueChange={(mode) =>
          onChange({
            ...value,
            projectAccess: mode === "selected" ? "selected" : "all",
          })
        }
      >
        <label className="flex items-start gap-3" htmlFor={`${id}-all`}>
          <Radio className="mt-0.5" id={`${id}-all`} value="all" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">
              {t("team:projectAccess.allProjects")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("team:projectAccess.allProjectsDescription")}
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3" htmlFor={`${id}-selected`}>
          <Radio className="mt-0.5" id={`${id}-selected`} value="selected" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">
              {t("team:projectAccess.selectedProjects")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("team:projectAccess.selectedProjectsDescription")}
            </p>
          </div>
        </label>
      </RadioGroup>

      {value.projectAccess === "selected" ? (
        <div
          role="group"
          aria-label={t("team:projectAccess.projectsLabel")}
          aria-describedby={error ? errorId : undefined}
          className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-dashed border-border/80 px-3 py-3"
        >
          {isLoadingProjects ? (
            <>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </>
          ) : !projects?.length ? (
            <p className="text-sm text-muted-foreground">
              {t("team:projectAccess.noProjects")}
            </p>
          ) : (
            projects.map((project) => {
              const checkboxId = `${id}-project-${project.id}`;
              return (
                <label
                  key={project.id}
                  className="flex items-center gap-3"
                  htmlFor={checkboxId}
                >
                  <Checkbox
                    checked={value.projectIds.includes(project.id)}
                    disabled={disabled}
                    id={checkboxId}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...value,
                        projectIds: toggleProjectId(
                          value.projectIds,
                          project.id,
                          Boolean(checked),
                        ),
                      })
                    }
                  />
                  <span className="truncate text-sm font-medium">
                    {project.name}
                  </span>
                  {project.archivedAt ? (
                    <Badge variant="outline" className="shrink-0">
                      {t("team:projectAccess.archived")}
                    </Badge>
                  ) : null}
                </label>
              );
            })
          )}
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default ProjectAccessFields;
