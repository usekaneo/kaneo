import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import useCreateQuickTask from "@/hooks/mutations/task/use-create-quick-task";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";

const NO_PROJECT = "__none__";

export function CreateQuickTaskDialog({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const createQuickTask = useCreateQuickTask(workspaceId);
  const { data } = useGetProjects({ workspaceId });
  const projects = data ?? [];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setProjectId(NO_PROJECT);
    setDueDate("");
  }, [open]);

  const save = async () => {
    if (!title.trim()) return;
    try {
      await createQuickTask.mutateAsync({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: projectId === NO_PROJECT ? undefined : projectId,
        // Noon keeps the picked calendar day stable across time zones.
        dueDate: dueDate
          ? new Date(`${dueDate}T12:00:00`).toISOString()
          : undefined,
      });
      toast.success(t("myWork:tasks.created"));
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("myWork:tasks.createError"),
      );
    }
  };

  const projectName =
    projectId === NO_PROJECT
      ? t("myWork:tasks.dailyProject")
      : (projects.find((p) => p.id === projectId)?.name ?? "");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("myWork:tasks.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <form
            id={`${id}-form`}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor={`${id}-title`}>{t("myWork:tasks.name")}</Label>
              <Input
                id={`${id}-title`}
                value={title}
                maxLength={500}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("myWork:tasks.namePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-description`}>
                {t("myWork:tasks.description")}
              </Label>
              <Textarea
                id={`${id}-description`}
                value={description}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("myWork:tasks.project")}</Label>
                <Select
                  value={projectId}
                  onValueChange={(value) => {
                    if (typeof value === "string") setProjectId(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>{projectName}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>
                      {t("myWork:tasks.dailyProject")}
                    </SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-due`}>{t("myWork:tasks.dueDate")}</Label>
                <Input
                  id={`${id}-due`}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            {projectId === NO_PROJECT && (
              <p className="text-muted-foreground text-xs">
                {t("myWork:tasks.dailyHint")}
              </p>
            )}
          </form>
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" size="sm" type="button" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button
            size="sm"
            type="submit"
            form={`${id}-form`}
            disabled={createQuickTask.isPending || !title.trim()}
          >
            {t("myWork:tasks.create")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
