import { useNavigate } from "@tanstack/react-router";
import { format, isValid, parseISO } from "date-fns";
import { ArrowUpRight, CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Activity from "@/components/activity";
import CommentInput from "@/components/activity/comment-input";
import { isCommentActivity } from "@/components/activity/utils";
import { ExternalLinksAccordion } from "@/components/external-links/external-links-accordion";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Timeline } from "@/components/ui/timeline";
import useSetCustomFieldValue from "@/hooks/mutations/custom-field/use-set-custom-field-value";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import useGetCustomFieldValuesByTask from "@/hooks/queries/custom-field/use-get-custom-field-values-by-task";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { ExternalLink } from "@/types/external-link";
import TaskDescription from "./task-description";
import TaskRelations from "./task-relations";
import TaskSubtasks from "./task-subtasks";
import TaskTitle from "./task-title";

type CustomFieldType = "text" | "number" | "date" | "dropdown" | "boolean";

type CustomFieldDefinition = {
  id: string;
  projectId: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue: string | null;
  options: string[] | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type TaskDetailsContentProps = {
  taskId: string | undefined;
  projectId: string;
  workspaceId: string;
  className?: string;
};

export default function TaskDetailsContent({
  taskId,
  projectId,
  workspaceId,
  className,
}: TaskDetailsContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: task } = useGetTask(taskId ?? "");
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: activities = [] } = useGetActivitiesByTaskId(taskId ?? "");
  const { data: externalLinks = [], isLoading: isLoadingExternalLinks } =
    useExternalLinks(taskId ?? "");
  const { data: relations = [] } = useGetTaskRelations(taskId ?? "");
  const { user } = useAuth();

  const { data: customFields = [] } = useGetCustomFieldsByProject(
    projectId,
  ) as { data: CustomFieldDefinition[] | undefined };

  const { data: customFieldValues = [] } = useGetCustomFieldValuesByTask(
    taskId ?? "",
  );

  const { mutateAsync: setCustomFieldValue } = useSetCustomFieldValue();
  const { canManageTasks } = useWorkspacePermission();
  const canEdit = canManageTasks();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const valuesMap: Record<string, string> = {};

    for (const field of customFields) {
      valuesMap[field.id] = field.defaultValue || "";
    }

    for (const val of customFieldValues) {
      if (val.value !== null) {
        valuesMap[val.fieldId] = val.value;
      }
    }

    setLocalValues(valuesMap);
  }, [customFields, customFieldValues]);

  const handleLocalChange = (fieldId: string, val: string) => {
    setLocalValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleSaveField = async (fieldId: string, value: string) => {
    if (!taskId) return;

    const existingValObj = customFieldValues.find((v) => v.fieldId === fieldId);
    const existingVal = existingValObj ? (existingValObj.value ?? "") : "";

    if (value === existingVal) return;

    try {
      await setCustomFieldValue({
        taskId,
        fieldId,
        value,
        projectId,
      });

      toast.success(t("tasks:detail.customFieldUpdated", "Field updated"));
    } catch (error) {
      handleLocalChange(fieldId, existingVal);
      toast.error(
        error instanceof Error ? error.message : "Failed to update field",
      );
    }
  };

  const parentRelation = relations.find(
    (rel) => rel.relationType === "subtask" && rel.targetTaskId === taskId,
  );
  const parentTask = parentRelation?.sourceTask;

  if (!taskId) return null;

  return (
    <div className={`${className} gap-4`}>
      <div className="flex flex-col gap-2.5">
        {parentTask && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            onClick={() =>
              navigate({
                to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                params: {
                  workspaceId,
                  projectId,
                  taskId: parentTask.id,
                },
              })
            }
          >
            <ArrowUpRight className="size-3" />
            <span>
              {t("tasks:detail.subtaskOf")}{" "}
              <span className="font-medium">{parentTask.title}</span>
            </span>
          </button>
        )}

        <p className="text-xs font-semibold text-foreground/70">
          {project?.slug}-{task?.number}
        </p>

        <TaskTitle taskId={taskId} />
        <TaskDescription taskId={taskId} />
      </div>

      {customFields.length > 0 && (
        <div className="mt-2">
          <Accordion className="w-full">
            <AccordionItem
              value="custom-fields"
              className="rounded-lg border border-border bg-sidebar/30 px-4"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="text-sm font-semibold text-foreground">
                    {t("tasks:common.customFields")}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {customFields.length}
                  </span>
                </div>
              </AccordionTrigger>

              <AccordionContent className="pb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {customFields.map((field) => {
                    const val = localValues[field.id] ?? "";

                    return (
                      <div
                        key={`custom-field-${field.id}`}
                        className="space-y-1.5"
                      >
                        <label
                          htmlFor={`custom-field-${field.id}`}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
                        >
                          {field.name}
                          {field.required && (
                            <span className="text-destructive">*</span>
                          )}
                        </label>

                        {field.type === "dropdown" ? (
                          <Select
                            value={val}
                            onValueChange={(newVal) => {
                              handleLocalChange(field.id, newVal as string);
                              void handleSaveField(field.id, newVal as string);
                            }}
                            disabled={!canEdit}
                          >
                            <SelectTrigger className="h-9 w-full bg-background text-sm">
                              <SelectValue
                                placeholder={t(
                                  "tasks:detail.selectOption",
                                  "Select option",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options || []).map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === "date" ? (
                          <Popover>
                            <PopoverTrigger
                              render={
                                <Button
                                  variant="outline"
                                  disabled={!canEdit}
                                  className={cn(
                                    "h-9 w-full justify-start bg-background text-left text-sm font-normal",
                                    !val && "text-muted-foreground",
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                                  {val && isValid(parseISO(val))
                                    ? format(parseISO(val), "dd MMM yyyy")
                                    : t("tasks:detail.pickDate", "Pick a date")}
                                </Button>
                              }
                            />
                            <PopoverContent
                              side="bottom"
                              align="start"
                              className="w-auto p-0"
                            >
                              <Calendar
                                mode="single"
                                selected={
                                  val && isValid(parseISO(val))
                                    ? parseISO(val)
                                    : undefined
                                }
                                onSelect={(date) => {
                                  const iso = date
                                    ? format(date, "yyyy-MM-dd")
                                    : "";
                                  handleLocalChange(field.id, iso);
                                  void handleSaveField(field.id, iso);
                                }}
                                captionLayout="dropdown"
                              />
                            </PopoverContent>
                          </Popover>
                        ) : field.type === "number" ? (
                          <Input
                            type="number"
                            value={val}
                            onChange={(e) =>
                              handleLocalChange(field.id, e.target.value)
                            }
                            onBlur={() => void handleSaveField(field.id, val)}
                            disabled={!canEdit}
                            className="h-9 w-full bg-background text-sm"
                          />
                        ) : field.type === "boolean" ? (
                          <div
                            className={cn(
                              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-muted px-3 text-sm",
                              !canEdit && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <span className="text-sm text-foreground capitalize">
                              {val}
                            </span>

                            <Switch
                              checked={val === "true"}
                              onCheckedChange={(checked) => {
                                const nextValue = checked ? "true" : "false";
                                handleLocalChange(field.id, nextValue);
                                void handleSaveField(field.id, nextValue);
                              }}
                              disabled={!canEdit}
                            />
                          </div>
                        ) : (
                          <Input
                            type="text"
                            value={val}
                            onChange={(e) =>
                              handleLocalChange(field.id, e.target.value)
                            }
                            onBlur={() => void handleSaveField(field.id, val)}
                            disabled={!canEdit}
                            className="h-9 w-full bg-background text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {!isLoadingExternalLinks && externalLinks.length > 0 && (
        <div className="mt-4">
          <ExternalLinksAccordion
            externalLinks={externalLinks as ExternalLink[]}
            isLoading={isLoadingExternalLinks}
          />
        </div>
      )}

      <div className="mt-4">
        {task && (
          <TaskSubtasks
            taskId={taskId}
            projectId={projectId}
            workspaceId={workspaceId}
            parentStatus={task.status}
          />
        )}
      </div>

      <div className="mt-2">
        <TaskRelations
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
        />
      </div>
      <span className="text-sm font-medium text-muted-foreground h-[1px] bg-border w-full block shrink-0" />
      <div className="flex flex-col gap-4">
        <h1 className="text-md font-semibold">{t("tasks:detail.activity")}</h1>

        {user?.id && taskId && <CommentInput taskId={taskId} />}

        {activities.length > 0 ? (
          <Timeline>
            {activities.map((activity, index) => {
              const nextActivity = activities[index + 1];
              const showConnector =
                !isCommentActivity(activity) &&
                Boolean(nextActivity) &&
                !isCommentActivity(nextActivity);

              return (
                <Activity
                  key={activity.id}
                  activity={activity}
                  step={activities.length - index}
                  showConnector={showConnector}
                />
              );
            })}
          </Timeline>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            {t("tasks:detail.noActivity")}
          </p>
        )}
      </div>
    </div>
  );
}
