import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { Download, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import useExportTasks from "@/hooks/mutations/task/use-export-tasks";
import useImportTasks from "@/hooks/mutations/task/use-import-tasks";
import { cn } from "@/lib/cn";
import type { ProjectWithTasks } from "@/types/project";

type TasksImportExportProps = {
  project: ProjectWithTasks;
};

export function TasksImportExport({ project }: TasksImportExportProps) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { mutateAsync: exportTasksMutation, isPending: isExporting } =
    useExportTasks();
  const { mutateAsync: importTasksMutation, isPending: isImporting } =
    useImportTasks();

  const handleExport = async () => {
    try {
      toast.loading("Exporting tasks...");
      const exportData = await exportTasksMutation(project.id);

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      saveAs(blob, `${project.slug}-tasks-export.json`);

      toast.dismiss();
      toast.success("Tasks exported successfully");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export tasks");
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
        toast.error("Invalid import file format");
        return;
      }

      toast.loading("Importing tasks...");

      const result = await importTasksMutation({
        projectId: project.id,
        tasks: jsonData.tasks,
      });

      queryClient.invalidateQueries({
        queryKey: ["project", project.id],
      });

      setIsImportOpen(false);
      toast.dismiss();
      toast.success(`Imported ${result.results.successful} tasks successfully`);

      if (result.results.failed > 0) {
        toast.error(`Failed to import ${result.results.failed} tasks`);
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to import tasks");
      console.error(error);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) {
      toast.error("No file was dropped");
      return;
    }

    if (file.type === "application/json" || file.name.endsWith(".json")) {
      confirmImport(file);
    } else {
      toast.error("Please upload a JSON file");
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
          className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export Tasks
        </Button>

        <Button
          className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"
          size="sm"
          onClick={() => setIsImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Import Tasks
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <Dialog.Root open={isImportOpen} onOpenChange={resetAndCloseModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Import Tasks
                </Dialog.Title>
                <Dialog.Close
                  asChild
                  className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                >
                  <X size={20} className="cursor-pointer" />
                </Dialog.Close>
              </div>

              <div className="p-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  Upload a JSON file containing tasks to import into this
                  project.
                </p>

                <div className="mb-4 p-3 bg-zinc-950 dark:bg-zinc-900 rounded-md border border-zinc-200/10 dark:border-zinc-800/50 font-mono text-sm">
                  <p className="text-zinc-400 dark:text-zinc-500 mb-1 text-xs">
                    Expected format:
                  </p>
                  <pre className="text-zinc-100 dark:text-zinc-200 overflow-auto max-h-32 text-xs">
                    {`{
  "tasks": [
    {
      "title": "Task title",
      "description": "Description text",
      "status": "to-do",
      "priority": "low",
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
                    "border-zinc-300 dark:border-zinc-700",
                    "hover:border-zinc-400 dark:hover:border-zinc-600",
                    "bg-zinc-50 dark:bg-zinc-800/30",
                    "transition-colors",
                  )}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Upload className="h-8 w-8 text-zinc-400" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Drag and drop your JSON file here
                    </p>
                    <Button
                      className="mt-2 bg-white hover:bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"
                      size="sm"
                      onClick={handleImportClick}
                      disabled={isImporting}
                    >
                      {isImporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        "Select File"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button className="bg-white hover:bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700">
                      Cancel
                    </Button>
                  </Dialog.Close>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
