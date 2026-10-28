import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ImportTasksDialog } from "@/components/project/tasks-import-export/import-tasks-dialog";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import type { ProjectWithTasks } from "@/types/project";

type ImportTasksRowProps = {
  project: ProjectWithTasks;
};

export function ImportTasksRow({ project }: ImportTasksRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <SettingsRow
      icon={<Download />}
      title={t("settings:tasksImportExport.importTasks")}
      description={t("settings:tasksImportExport.importDescription")}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-24"
        onClick={() => setOpen(true)}
      >
        {t("settings:tasksImportExport.import")}
      </Button>
      <ImportTasksDialog
        projectId={project.id}
        open={open}
        onOpenChange={setOpen}
      />
    </SettingsRow>
  );
}
