import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { toast } from "@/lib/toast";
import type { ProjectWithTasks } from "@/types/project";

type ProjectSprintsSectionProps = {
  project: ProjectWithTasks;
  canEdit: boolean;
};

export function ProjectSprintsSection({
  project,
  canEdit,
}: ProjectSprintsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const { mutateAsync: updateProject } = useUpdateProject();

  // The board payload that feeds the project store does not carry sprint
  // settings, so read them through the project detail query.
  const { data: projectDetails } = useGetProject({
    id: project.id,
    workspaceId: workspace?.id ?? "",
  });

  // Outside the auto-saving project form: the sprint length is an explicit
  // save, so it stays in local state until the user confirms it.
  const [sprintLengthDays, setSprintLengthDays] = useState<number>(14);

  useEffect(() => {
    if (projectDetails?.defaultSprintLengthDays) {
      setSprintLengthDays(projectDetails.defaultSprintLengthDays);
    }
  }, [projectDetails?.defaultSprintLengthDays]);

  const handleSaveSprintLength = useCallback(async () => {
    const days = Math.max(1, Math.trunc(sprintLengthDays || 14));

    try {
      await updateProject({
        id: project.id,
        name: project.name,
        icon: project.icon ?? "Layout",
        slug: project.slug,
        description: project.description ?? "",
        isPublic: !!project.isPublic,
        defaultSprintLengthDays: days,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({
          queryKey: ["projects", workspace?.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["projects", workspace?.id, project.id],
        }),
      ]);
      toast.success(t("settings:projectGeneral.sprintLengthSaved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectGeneral.sprintLengthError"),
      );
    }
  }, [
    project.id,
    project.name,
    project.slug,
    project.description,
    project.icon,
    project.isPublic,
    sprintLengthDays,
    updateProject,
    queryClient,
    workspace?.id,
    t,
  ]);

  return (
    <SettingsSection
      title={t("settings:projectGeneral.sprints")}
      description={t("settings:projectGeneral.sprintsSubtitle")}
    >
      <SettingsCard>
        <SettingsRow
          title={t("settings:projectGeneral.sprintLength")}
          description={t("settings:projectGeneral.sprintLengthDescription")}
        >
          <Input
            type="number"
            min={1}
            className="w-24"
            value={sprintLengthDays}
            onChange={(event) =>
              setSprintLengthDays(Number(event.target.value))
            }
            disabled={!canEdit}
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={
              !canEdit ||
              !Number.isFinite(sprintLengthDays) ||
              sprintLengthDays < 1 ||
              Math.max(1, Math.trunc(sprintLengthDays || 14)) ===
                projectDetails?.defaultSprintLengthDays
            }
            onClick={() => void handleSaveSprintLength()}
          >
            {t("settings:projectGeneral.sprintLengthSave")}
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
