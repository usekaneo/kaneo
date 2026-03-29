import { useQueryClient } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { Download, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import useExportTasks from "@/hooks/mutations/task/use-export-tasks";
import useImportTasks from "@/hooks/mutations/task/use-import-tasks";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { ProjectWithTasks } from "@/types/project";

type TasksImportExportProps = {
  project: ProjectWithTasks;
};

export function TasksImportExport({ project }: TasksImportExportProps) {
  const { t } = useTranslation();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { mutateAsync: exportTasksMutation, isPending: isExporting } =
    useExportTasks();
  const { mutateAsync: importTasksMutation, isPending: isImporting } =
    useImportTasks();

  const handleExport = async () => {
    try {
      toast.loading(t("settings:tasksImportExport.exporting"));
      const exportData = await exportTasksMutation(project.id);

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      saveAs(blob, `${project.slug}-tasks-export.json`);

      toast.dismiss();
      toast.success(t("settings:tasksImportExport.exportSuccess"));
    } catch (error) {
      toast.dismiss();
      toast.error(t("settings:tasksImportExport.exportError"));
      console.error(error);
    }
  };

  const handleImportClick = () => {
    setIsImportOpen(true);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    confirmImport(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmImport = async (file: File) => {
    try {
      const content = await file.text();
      const jsonData = JSON.parse(content);

      if (!jsonData.tasks || !Array.isArray(jsonData.tasks)) {
        toast.error(t("settings:tasksImportExport.invalidFormat"));
        return;
      }

      toast.loading(t("settings:tasksImportExport.importing"));

      const result = await importTasksMutation({
        projectId: project.id,
        tasks: jsonData.tasks,
      });

      queryClient.invalidateQueries({
        queryKey: ["project", project.id],
      });

      setIsImportOpen(false);
      toast.dismiss();
      toast.success(
        t("settings:tasksImportExport.importSuccess", {
          count: result.results.successful,
        }),
      );

      if (result.results.failed > 0) {
        toast.error(
          t("settings:tasksImportExport.importPartialError", {
            count: result.results.failed,
          }),
        );
      }
    } catch (error) {
      toast.dismiss();
      toast.error(t("settings:tasksImportExport.importError"));
      console.error(error);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) {
      toast.error(t("settings:tasksImportExport.noFileDropped"));
      return;
    }

    if (file.type === "application/json" || file.name.endsWith(".json")) {
      confirmImport(file);
    } else {
      toast.error(t("settings:tasksImportExport.notJsonFile"));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetAndCloseModal = () => {
    setIsImportOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          className="flex items-center gap-1.5 bg-card hover:bg-accent text-foreground border border-border"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {t("settings:tasksImportExport.exportTasks")}
        </Button>

        <Button
          className="flex items-center gap-1.5 bg-card hover:bg-accent text-foreground border border-border"
          size="sm"
          onClick={() => setIsImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          {t("settings:tasksImportExport.importTasks")}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <Dialog open={isImportOpen} onOpenChange={resetAndCloseModal}>
        <DialogPopup className="w-full max-w-md">
          <div className="bg-card rounded-lg shadow-xl border border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {t("settings:tasksImportExport.dialogTitle")}
              </DialogTitle>
              <DialogClose
                className="text-muted-foreground hover:text-foreground"
                render={<button type="button" />}
              >
                <X size={20} className="cursor-pointer" />
              </DialogClose>
            </div>

            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-2">
                {t("settings:tasksImportExport.dialogDescription")}
              </p>

              <div className="mb-4 p-3 bg-muted rounded-md border border-border/50 font-mono text-sm">
                <p className="text-muted-foreground mb-1 text-xs">
                  {t("settings:tasksImportExport.expectedFormat")}
                </p>
                <pre className="text-foreground overflow-auto max-h-32 text-xs">
                  {`{
  "tasks": [
    {
      "title": "Task title",
      "description": "Description text",
      "status": "to-do",
      "priority": "low",
      "startDate": "2025-04-18T00:00:00.000Z",
      "dueDate": "2025-04-20T00:00:00.000Z",
      "userId": "user@example.com"
    }
  ]
}`}
                </pre>
              </div>

              {/** biome-ignore lint/a11y/noStaticElementInteractions: false positive for onDrop and onDragOver */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center mb-4",
                  "border-border",
                  "hover:border-ring",
                  "bg-muted/60",
                  "transition-colors",
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("settings:tasksImportExport.dropHint")}
                  </p>
                  <Button
                    className="mt-2 bg-card hover:bg-accent text-foreground border border-border"
                    size="sm"
                    onClick={handleImportClick}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      t("settings:tasksImportExport.selectFile")
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <DialogClose
                  render={
                    <Button className="bg-card hover:bg-accent text-foreground border border-border" />
                  }
                >
                  {t("common:actions.cancel")}
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
