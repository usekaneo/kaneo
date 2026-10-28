import { saveAs } from "file-saver";
import { Loader2, Upload, DownloadIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import useExportTasks from "@/hooks/mutations/task/use-export-tasks";
import { toast } from "@/lib/toast";
import type { ProjectWithTasks } from "@/types/project";

type ExportTasksRowProps = {
  project: ProjectWithTasks;
};

export function ExportTasksRow({ project }: ExportTasksRowProps) {
  const { t } = useTranslation();
  const { mutateAsync: exportTasks, isPending } = useExportTasks();

  const handleExport = async () => {
    try {
      toast.loading(t("settings:tasksImportExport.exporting"));
      const exportData = await exportTasks(project.id);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      saveAs(blob, `${project.slug}-tasks-export.json`);

      toast.dismiss();
      toast.success(t("settings:tasksImportExport.exportSuccess"), {
        icon: DownloadIcon,
      });
    } catch (error) {
      toast.dismiss();
      toast.error(t("settings:tasksImportExport.exportError"));
      console.error(error);
    }
  };

  return (
    <SettingsRow
      icon={<Upload />}
      title={t("settings:tasksImportExport.exportTasks")}
      description={t("settings:tasksImportExport.exportDescription")}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-24"
        onClick={handleExport}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {t("settings:tasksImportExport.export")}
      </Button>
    </SettingsRow>
  );
}
