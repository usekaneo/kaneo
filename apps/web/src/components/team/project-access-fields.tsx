import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Field, FieldError } from "@/components/ui/field";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectAccessValue } from "./project-access/project-access-value";

type Props = {
  value: ProjectAccessValue;
  onChange: (value: ProjectAccessValue) => void;
  projects:
    | readonly { id: string; name: string; archivedAt?: string | null }[]
    | undefined;
  isLoadingProjects?: boolean;
  disabled?: boolean;
  allowAll?: boolean;
  error?: string;
};

function ProjectAccessFields({
  value,
  onChange,
  projects,
  isLoadingProjects = false,
  disabled = false,
  allowAll = true,
  error,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <Fieldset
        className="max-w-none gap-3"
        render={
          <RadioGroup
            disabled={disabled}
            value={value.projectAccess}
            onValueChange={(mode) =>
              onChange({
                ...value,
                projectAccess: mode === "selected" ? "selected" : "all",
              })
            }
          />
        }
      >
        <div className="flex flex-col gap-0.5">
          <FieldsetLegend className="text-sm font-medium">
            {t("team:projectAccess.label")}
          </FieldsetLegend>
          <p className="text-muted-foreground text-xs">
            {t("team:projectAccess.description")}
          </p>
        </div>
        <Label className="items-start gap-3">
          <Radio value="all" disabled={!allowAll} />
          <span className="flex flex-col gap-0.5">
            {t("team:projectAccess.allProjects")}
            <span className="font-normal text-muted-foreground text-xs">
              {allowAll
                ? t("team:projectAccess.allProjectsDescription")
                : t("team:projectAccess.allProjectsUnavailable")}
            </span>
          </span>
        </Label>
        <Label className="items-start gap-3">
          <Radio value="selected" />
          <span className="flex flex-col gap-0.5">
            {t("team:projectAccess.selectedProjects")}
            <span className="font-normal text-muted-foreground text-xs">
              {t("team:projectAccess.selectedProjectsDescription")}
            </span>
          </span>
        </Label>
      </Fieldset>

      {value.projectAccess === "selected" ? (
        <Field className="ps-7" invalid={Boolean(error)}>
          <Fieldset
            className="max-w-none gap-3"
            render={
              <CheckboxGroup
                disabled={disabled}
                value={value.projectIds}
                onValueChange={(projectIds) =>
                  onChange({ ...value, projectIds })
                }
              />
            }
          >
            <FieldsetLegend className="sr-only">
              {t("team:projectAccess.projectsLabel")}
            </FieldsetLegend>
            {isLoadingProjects ? (
              <>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </>
            ) : !projects?.length ? (
              <p className="text-muted-foreground text-sm">
                {t("team:projectAccess.noProjects")}
              </p>
            ) : (
              projects.map((project) => (
                <Label key={project.id} className="max-w-full">
                  <Checkbox value={project.id} />
                  <span className="truncate">{project.name}</span>
                  {project.archivedAt ? (
                    <Badge variant="outline" className="shrink-0">
                      {t("team:projectAccess.archived")}
                    </Badge>
                  ) : null}
                </Label>
              ))
            )}
          </Fieldset>
          {error ? <FieldError match>{error}</FieldError> : null}
        </Field>
      ) : null}
    </div>
  );
}

export default ProjectAccessFields;
