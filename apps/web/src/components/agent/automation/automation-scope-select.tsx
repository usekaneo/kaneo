import { Building2, FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useGetProjects from "@/hooks/queries/project/use-get-projects";

const WORKSPACE = "__workspace__";

type AutomationScopeSelectProps = {
  workspaceId: string;
  value: string | null;
  onValueChange: (projectId: string | null) => void;
};

export function AutomationScopeSelect({
  workspaceId,
  value,
  onValueChange,
}: AutomationScopeSelectProps) {
  const { t } = useTranslation();
  const { data: projects } = useGetProjects({ workspaceId });
  const selected = projects?.find((project) => project.id === value);
  const Icon = value ? FolderKanban : Building2;

  return (
    <div className="flex flex-col gap-2">
      <Label id="automation-scope-label">
        {t("agent:automations.form.scope")}
      </Label>
      <Select
        value={value ?? WORKSPACE}
        onValueChange={(next) => {
          if (next) onValueChange(next === WORKSPACE ? null : next);
        }}
      >
        <SelectTrigger size="sm" aria-labelledby="automation-scope-label">
          <SelectValue>
            <span className="flex min-w-0 items-center gap-2">
              <Icon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span className="truncate">
                {value
                  ? (selected?.name ?? "…")
                  : t("agent:automations.scope.wholeWorkspace")}
              </span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WORKSPACE}>
            {t("agent:automations.scope.wholeWorkspace")}
          </SelectItem>
          {projects?.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
