import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useUpdateTaskRelation from "@/hooks/mutations/task-relation/use-update-task-relation";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export type GanttDependencyType = "fs" | "ss" | "ff" | "sf";

const DEPENDENCY_TYPES: GanttDependencyType[] = ["fs", "ss", "ff", "sf"];

type TaskRelationDependencyPopoverProps = {
  relationId: string;
  /** The task whose relation list this popover was opened from — used only
   * to invalidate that task's own cache on save. */
  taskId: string;
  dependencyType: string;
  lagDays: number;
  children: React.ReactNode;
};

// Lets a "blocks" relation's dependency type (FS/SS/FF/SF) and lag/lead be
// edited in place, from the relation list on a task's detail page. Only
// "blocks" relations carry a meaningful type/lag (see the API), so the
// caller only renders this for that group.
export default function TaskRelationDependencyPopover({
  relationId,
  taskId,
  dependencyType,
  lagDays,
  children,
}: TaskRelationDependencyPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<GanttDependencyType>(
    dependencyType as GanttDependencyType,
  );
  const [lagInput, setLagInput] = useState(String(lagDays));
  const updateRelation = useUpdateTaskRelation(taskId);
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  // Reset the draft to the current values every time the popover opens,
  // rather than whenever the props change, so an in-progress edit isn't
  // clobbered by a background refetch while it's still open.
  useEffect(() => {
    if (!open) return;
    setType(dependencyType as GanttDependencyType);
    setLagInput(String(lagDays));
  }, [open, dependencyType, lagDays]);

  const handleSave = async () => {
    const parsedLag = Number.parseInt(lagInput, 10);
    try {
      await updateRelation.mutateAsync({
        id: relationId,
        dependencyType: type,
        lagDays: Number.isNaN(parsedLag) ? 0 : parsedLag,
      });
      setOpen(false);
    } catch {
      toast.error(t("tasks:relations.dependency.updateError"));
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("tasks:relations.dependency.typeLabel")}
            </Label>
            <Select
              value={type}
              onValueChange={(value) =>
                setType(String(value) as GanttDependencyType)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {t(`tasks:relations.dependency.types.${type}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DEPENDENCY_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`tasks:relations.dependency.types.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("tasks:relations.dependency.lagLabel")}
            </Label>
            <Input
              type="number"
              value={lagInput}
              onChange={(e) => setLagInput(e.target.value)}
              placeholder="0"
            />
            <p className="text-[11px] text-muted-foreground/70">
              {t("tasks:relations.dependency.lagHint")}
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateRelation.isPending}
          >
            {t("tasks:relations.dependency.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
