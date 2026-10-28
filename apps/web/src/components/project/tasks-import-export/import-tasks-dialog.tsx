import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, UploadIcon } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  isJsonFile,
  parseTasksImport,
} from "@/components/project/tasks-import-export/tasks-import-file";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import useImportTasks from "@/hooks/mutations/task/use-import-tasks";
import { toast } from "@/lib/toast";

const EXAMPLE_FORMAT = `{
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
}`;

type ImportTasksDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportTasksDialog({
  projectId,
  open,
  onOpenChange,
}: ImportTasksDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: importTasks, isPending } = useImportTasks();

  const importFile = async (file: File) => {
    try {
      const tasks = parseTasksImport(await file.text());

      if (!tasks) {
        toast.error(t("settings:tasksImportExport.invalidFormat"));
        return;
      }

      toast.loading(t("settings:tasksImportExport.importing"));

      const result = await importTasks({ projectId, tasks });

      queryClient.invalidateQueries({ queryKey: ["project", projectId] });

      onOpenChange(false);
      toast.dismiss();
      toast.success(
        t("settings:tasksImportExport.importSuccess", {
          count: result.results.successful,
        }),
        { icon: UploadIcon },
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void importFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (!file) {
      toast.error(t("settings:tasksImportExport.noFileDropped"));
      return;
    }

    if (!isJsonFile(file)) {
      toast.error(t("settings:tasksImportExport.notJsonFile"));
      return;
    }

    void importFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("settings:tasksImportExport.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settings:tasksImportExport.dialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {t("settings:tasksImportExport.expectedFormat")}
            </p>
            <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs">
              {EXAMPLE_FORMAT}
            </pre>
          </div>
          <div
            className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-ring"
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
          >
            <Upload
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings:tasksImportExport.dropHint")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {t("settings:tasksImportExport.selectFile")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("common:actions.cancel")}
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
