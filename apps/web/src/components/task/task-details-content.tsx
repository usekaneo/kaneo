import { useNavigate } from "@tanstack/react-router";
import { format, isValid, parseISO } from "date-fns";
import { ArrowUpRight, CalendarIcon, X } from "lucide-react";
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
import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
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
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { ExternalLink } from "@/types/external-link";
import TaskDescription from "./task-description";
import TaskRelations from "./task-relations";
import TaskSubtasks from "./task-subtasks";
import TaskTitle from "./task-title";

type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "boolean"
  | "multiselect";

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

type CustomFieldValueMap = Record<string, string | string[]>;

type TaskDetailsContentProps = {
  taskId: string | undefined;
  projectId: string;
  workspaceId: string;
  className?: string;
};

function safeParseMultiselect(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
    return [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

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
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const [localValues, setLocalValues] = useState<CustomFieldValueMap>({});

  useEffect(() => {
    const valuesMap: CustomFieldValueMap = {};

    for (const field of customFields) {
      valuesMap[field.id] = field.type === "multiselect" ? [] : "";
    }

    for (const val of customFieldValues) {
      const field = customFields.find((f) => f.id === val.fieldId);

      if (!field) continue;

      valuesMap[val.fieldId] =
        field.type === "multiselect"
          ? safeParseMultiselect(val.value)
          : (val.value ?? "");
    }

    setLocalValues(valuesMap);
  }, [customFields, customFieldValues]);

  const handleLocalChange = (fieldId: string, val: string | string[]) => {
    setLocalValues((prev: CustomFieldValueMap) => ({
      ...prev,
      [fieldId]: val,
    }));
  };

  const handleSaveField = async (fieldId: string, value: string | string[]) => {
    if (!taskId) return;

    const field = customFields.find((f) => f.id === fieldId);
    const existingValObj = customFieldValues.find((v) => v.fieldId === fieldId);
    const existingRaw = existingValObj ? (existingValObj.value ?? "") : "";

    const isMultiselect = field?.type === "multiselect";

    const serializedValue = isMultiselect
      ? JSON.stringify(value as string[])
      : (value as string);

    const existingComparable = isMultiselect
      ? JSON.stringify(safeParseMultiselect(existingRaw))
      : existingRaw;

    if (serializedValue === existingComparable) return;

    try {
      await setCustomFieldValue({
        taskId,
        fieldId,
        value: serializedValue,
        projectId,
      });

      toast.success(t("tasks:detail.customFieldUpdated", "Field updated"));
    } catch (error) {
      handleLocalChange(
        fieldId,
        isMultiselect ? safeParseMultiselect(existingRaw) : existingRaw,
      );
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
                    const multiselectVal: string[] = Array.isArray(val)
                      ? val
                      : [];
                    const textVal: string = Array.isArray(val) ? "" : val;

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
                            value={textVal}
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
                            <SelectContent className="max-w-[25rem]">
                              {!field.required && (
                                <SelectItem key="empty" value="">
                                  {t("tasks:detail.selectOption")}
                                </SelectItem>
                              )}
                              {Array.from(new Set(field.options || [])).map(
                                (opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    <span className="block max-w-38 truncate">
                                      {opt}
                                    </span>
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        ) : field.type === "date" ? (
                          <div className="relative w-full">
                            <Popover>
                              <PopoverTrigger
                                render={
                                  <Button
                                    variant="outline"
                                    type="button"
                                    disabled={!canEdit}
                                    className={cn(
                                      "h-10! w-full justify-start rounded-md bg-background pr-10 text-left text-sm font-normal",
                                      !textVal && "text-muted-foreground",
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 size-4 shrink-0 opacity-70" />

                                    <span className="truncate">
                                      {textVal && isValid(parseISO(textVal))
                                        ? formatDateMedium(parseISO(textVal))
                                        : t(
                                            "tasks:detail.pickDate",
                                            "Pick a date",
                                          )}
                                    </span>
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
                                    textVal && isValid(parseISO(textVal))
                                      ? parseISO(textVal)
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

                            {!field.required && (
                              <Button
                                variant="ghost"
                                type="button"
                                disabled={!canEdit || !textVal}
                                onClick={() => {
                                  handleLocalChange(field.id, "");
                                  void handleSaveField(field.id, "");
                                }}
                                className={cn(
                                  "absolute right-1 top-1/2 z-10 size-8 -translate-y-1/2 rounded-md p-0 text-muted-foreground",
                                  canEdit && textVal
                                    ? "hover:bg-destructive/10 hover:text-destructive"
                                    : "cursor-not-allowed",
                                )}
                                aria-label={t("reset", {
                                  field: field.name ?? field.id,
                                })}
                              >
                                <X
                                  className="size-4"
                                  strokeWidth={2.5}
                                  aria-hidden="true"
                                />
                              </Button>
                            )}
                          </div>
                        ) : field.type === "number" ? (
                          <Input
                            type="number"
                            value={textVal}
                            placeholder={field.defaultValue?.toString()}
                            onChange={(e) =>
                              handleLocalChange(field.id, e.target.value)
                            }
                            onBlur={() =>
                              void handleSaveField(field.id, textVal)
                            }
                            disabled={!canEdit}
                            className="h-9 w-full bg-background text-sm"
                          />
                        ) : field.type === "boolean" ? (
                          <div
                            className={cn(
                              "flex h-10 w-full items-center gap-3 rounded-md border border-input bg-muted/50 px-3 text-sm transition-colors",
                              canEdit && "hover:bg-muted",
                              !canEdit && "opacity-50",
                            )}
                          >
                            <span className="flex-1 truncate text-foreground">
                              {t(`common:boolean.${textVal || "notSet"}`)}
                            </span>

                            <Switch
                              checked={textVal === "true"}
                              onCheckedChange={(checked) => {
                                const nextValue = checked ? "true" : "false";

                                handleLocalChange(field.id, nextValue);
                                void handleSaveField(field.id, nextValue);
                              }}
                              disabled={!canEdit}
                              aria-label={t("modify", {
                                field: field.name ?? field.id,
                              })}
                            />

                            {!field.required && (
                              <Button
                                variant="ghost"
                                type="button"
                                disabled={!canEdit}
                                onClick={() => {
                                  handleLocalChange(field.id, "");
                                  void handleSaveField(field.id, "");
                                }}
                                className={cn(
                                  "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
                                  canEdit
                                    ? "hover:bg-destructive/10 hover:text-destructive"
                                    : "cursor-not-allowed",
                                )}
                                aria-label={t("reset", {
                                  field: field.name ?? field.id,
                                })}
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                        ) : field.type === "multiselect" ? (
                          <Combobox
                            multiple={true}
                            autoHighlight
                            items={Array.from(new Set(field.options ?? []))}
                            value={multiselectVal}
                            onValueChange={(newVal) => {
                              const nextVal = newVal as string[];
                              handleLocalChange(field.id, nextVal);
                            }}
                            onOpenChange={(open) => {
                              if (!open) {
                                handleLocalChange(field.id, multiselectVal);
                                void handleSaveField(field.id, multiselectVal);
                              }
                            }}
                            disabled={!canEdit}
                          >
                            <ComboboxChips className="h-9 w-full flex-[2_0_0] select-none cursor-default text-sm disabled:opacity-50">
                              <ComboboxValue>
                                {(values: string[]) => {
                                  const MAX_VISIBLE_CHIPS = 3;
                                  const visibleChips = values.slice(
                                    0,
                                    MAX_VISIBLE_CHIPS,
                                  );
                                  const hiddenCount =
                                    values.length - MAX_VISIBLE_CHIPS;

                                  return (
                                    <>
                                      {visibleChips.map((value) => (
                                        <div
                                          key={value}
                                          className={cn(
                                            "min-w-0 max-w-full flex-1 shrink basis-0",
                                            "inline-flex items-center overflow-hidden",
                                            "rounded-md bg-secondary px-1.5 py-0.5",
                                            "select-none cursor-default",
                                          )}
                                        >
                                          <span className="block min-w-0 max-w-full truncate text-xs text-secondary-foreground">
                                            {value}
                                          </span>
                                        </div>
                                      ))}
                                      {values.length > MAX_VISIBLE_CHIPS && (
                                        <HoverCard>
                                          <HoverCardTrigger asChild>
                                            <button
                                              type="button"
                                              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium cursor-pointer text-foreground/50 pe-1"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                              }}
                                              onPointerDown={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                              }}
                                            >
                                              {t(
                                                "settings:customFields.moreOptions",
                                                {
                                                  hiddenCount,
                                                },
                                              )}
                                            </button>
                                          </HoverCardTrigger>

                                          <HoverCardContent
                                            side="top"
                                            align="start"
                                            className="flex max-w-xs flex-wrap gap-1"
                                          >
                                            <div className="space-y-1.5">
                                              <div className="text-xs font-medium text-muted-foreground">
                                                {t(
                                                  "settings:customFields.availableOptions",
                                                  "Available options",
                                                )}
                                              </div>

                                              <div className="flex min-w-0 max-h-48 flex-wrap gap-x-1.5 gap-y-1.5 overflow-y-auto overflow-x-hidden">
                                                {values
                                                  .slice(MAX_VISIBLE_CHIPS)
                                                  .map((value) => (
                                                    <div
                                                      key={value}
                                                      className={cn(
                                                        "min-w-0 max-w-full",
                                                        "inline-flex items-center overflow-hidden",
                                                        "rounded bg-secondary px-1.5 py-0.5",
                                                        "select-none cursor-default",
                                                      )}
                                                    >
                                                      <span className="block min-w-0 max-w-[13rem] truncate text-xs">
                                                        {value}
                                                      </span>
                                                    </div>
                                                  ))}
                                              </div>
                                            </div>
                                          </HoverCardContent>
                                        </HoverCard>
                                      )}

                                      <ComboboxChipsInput
                                        className={cn(
                                          "min-w-0 flex-1 caret-transparent",
                                          values.length > 0 && "hidden",
                                          "pointer-events-none",
                                          "placeholder:text-foreground/50",
                                          "text-transparent",
                                        )}
                                        placeholder={
                                          Array.from(
                                            new Set(field.options ?? []),
                                          ).length === 0
                                            ? t(
                                                "settings:customFields.noOptionsPlaceholder",
                                                "No options",
                                              )
                                            : values.length === 0
                                              ? t(
                                                  "settings:customFields.defaultValuePlaceholder",
                                                  "Default value",
                                                )
                                              : undefined
                                        }
                                      />
                                    </>
                                  );
                                }}
                              </ComboboxValue>
                            </ComboboxChips>

                            <ComboboxPopup>
                              <ComboboxEmpty>
                                {t(
                                  "settings:customFields.noOptionsPlaceholder",
                                  "No options",
                                )}
                              </ComboboxEmpty>

                              <ComboboxList>
                                {(option: string) => (
                                  <ComboboxItem
                                    className="min-w-0 max-w-full"
                                    key={`field_option_${option}`}
                                    value={option}
                                  >
                                    <span className="block max-w-38 truncate">
                                      {option}
                                    </span>
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxPopup>
                          </Combobox>
                        ) : (
                          <Input
                            type="text"
                            value={textVal}
                            placeholder={field.defaultValue?.toString()}
                            onChange={(e) =>
                              handleLocalChange(field.id, e.target.value)
                            }
                            onBlur={() =>
                              void handleSaveField(field.id, textVal)
                            }
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

      <div className="mt-4">
        <ExternalLinksAccordion
          taskId={taskId}
          externalLinks={externalLinks as ExternalLink[]}
          isLoading={isLoadingExternalLinks}
        />
      </div>
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
