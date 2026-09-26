import { format, isValid, parseISO } from "date-fns";
import {
  CalendarIcon,
  CheckSquare,
  GripVertical,
  Hash,
  List,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import useCreateCustomField from "@/hooks/mutations/custom-field/use-create-custom-field";
import useDeleteCustomField from "@/hooks/mutations/custom-field/use-delete-custom-field";
import { useReorderCustomFields } from "@/hooks/mutations/custom-field/use-reorder-custom-field";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "boolean"
  | "multiselect";

export type CustomFieldDefinition = {
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

const CUSTOM_FIELD_TYPES: Array<{
  value: CustomFieldType;
  icon: React.ElementType;
  availableOnTask?: boolean;
}> = [
  { value: "text", icon: Type, availableOnTask: true },
  { value: "number", icon: Hash, availableOnTask: true },
  { value: "date", icon: CalendarIcon, availableOnTask: true },
  { value: "dropdown", icon: List, availableOnTask: true },
  { value: "multiselect", icon: List, availableOnTask: false },
  { value: "boolean", icon: CheckSquare, availableOnTask: true },
];

type CustomFieldEditorProps = {
  projectId: string;
};

export default function CustomFieldEditor({
  projectId,
}: CustomFieldEditorProps) {
  const { t } = useTranslation();

  const { data: customFields = [], isLoading: customFieldsLoading } =
    useGetCustomFieldsByProject(projectId) as {
      data: CustomFieldDefinition[] | undefined;
      isLoading: boolean;
    };

  const { mutateAsync: createCustomField, isPending: savingField } =
    useCreateCustomField();
  const { mutateAsync: deleteCustomField, isPending: deletingField } =
    useDeleteCustomField(projectId);
  const { mutateAsync: reorderCustomFields } = useReorderCustomFields();

  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [required, setRequired] = useState(false);

  const [isMultiple, setIsMultiple] = useState(false);

  const [defaultValue, setDefaultValue] = useState<string | string[]>("");
  const [optionsText, setOptionsText] = useState("");
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [pendingFields, setPendingFields] = useState<
    CustomFieldDefinition[] | null
  >(null);
  const [isReordering, setIsReordering] = useState(false);

  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (type !== "boolean") return;

    if (defaultValue !== "true" && defaultValue !== "false") {
      setDefaultValue("false");
    }
  }, [type, defaultValue]);

  useEffect(() => {
    return () => {
      dragPreviewRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    setPendingFields(null);
  }, []);

  async function handleCreate() {
    try {
      if (!name.trim()) return;

      const options =
        type === "dropdown"
          ? Array.from(
              new Set(
                optionsText
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              ),
            )
          : undefined;

      let apiDefaultValue: string | undefined;

      const apiType: CustomFieldType =
        type === "dropdown" && isMultiple ? "multiselect" : type;

      if (apiType === "multiselect") {
        if (Array.isArray(defaultValue) && defaultValue.length > 0) {
          apiDefaultValue = JSON.stringify(defaultValue);
        }
      } else if (apiType === "dropdown") {
        if (typeof defaultValue === "string" && defaultValue.trim() !== "") {
          apiDefaultValue = defaultValue;
        }
      } else if (typeof defaultValue === "string") {
        if (defaultValue.trim() !== "") {
          apiDefaultValue = defaultValue;
        }
      }

      await createCustomField({
        projectId,
        name: name.trim(),
        type: apiType,
        required,
        defaultValue: apiDefaultValue,
        options,
      });

      setName("");
      setType("text");
      setRequired(false);
      setIsMultiple(false);
      setDefaultValue("");
      setOptionsText("");

      toast.success(t("settings:customFields.createSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:customFields.createError"),
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      setDeletingFieldId(id);
      await deleteCustomField({ id });
      toast.success(t("settings:customFields.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:customFields.deleteError"),
      );
    } finally {
      setDeletingFieldId(null);
    }
  }

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (isReordering) return;

    if (!pendingFields && customFields) {
      setPendingFields(customFields);
    }

    setDraggedIndex(index);

    dragPreviewRef.current?.remove();

    const sourceElement = e.currentTarget;
    const sourceRect = sourceElement.getBoundingClientRect();

    const dragPreview = sourceElement.cloneNode(true) as HTMLDivElement;

    dragPreview.setAttribute("aria-hidden", "true");
    dragPreview.inert = true;

    Object.assign(dragPreview.style, {
      position: "fixed",
      top: "-10000px",
      left: "-10000px",
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      margin: "0",
      boxSizing: "border-box",
      overflow: "hidden",
      pointerEvents: "none",
      transform: "none",
      contain: "layout paint",
    });

    document.body.appendChild(dragPreview);
    dragPreviewRef.current = dragPreview;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.setDragImage(
      dragPreview,
      e.clientX - sourceRect.left,
      e.clientY - sourceRect.top,
    );
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null) return;

    const currentFields = pendingFields ?? customFields;
    if (!currentFields || draggedIndex === index) return;

    const reordered = [...currentFields];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, removed);

    setPendingFields(reordered);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (isReordering) return;

    const finalFields = pendingFields ?? customFields;

    setDraggedIndex(null);

    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;

    if (!finalFields) {
      setPendingFields(null);
      return;
    }

    if (pendingFields === null) {
      return;
    }
    if (isReordering) return;

    try {
      const updates = finalFields.map((col, i) => ({
        id: col.id,
        position: i,
      }));

      await reorderCustomFields({ projectId, fields: updates });

      setPendingFields(null);
    } catch (error) {
      setPendingFields(null);

      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:customFields.reorderError"),
      );
    } finally {
      setIsReordering(false);
    }
  };

  const hasExtraInput =
    type === "dropdown" || type === "date" || type === "boolean";

  const dropdownOptions = useMemo(() => {
    return Array.from(
      new Set(
        optionsText
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    );
  }, [optionsText]);

  useEffect(() => {
    if (type !== "dropdown") {
      if (isMultiple) setIsMultiple(false);
      if (Array.isArray(defaultValue)) {
        setDefaultValue(defaultValue[0] ?? "");
      } else if (
        type !== "boolean" &&
        (defaultValue === "true" || defaultValue === "false")
      ) {
        setDefaultValue("");
      }
      return;
    }

    if (isMultiple) {
      if (!Array.isArray(defaultValue)) {
        setDefaultValue(defaultValue ? [defaultValue] : []);
      }
    } else {
      if (Array.isArray(defaultValue)) {
        setDefaultValue(defaultValue[0] ?? "");
      }
    }
  }, [isMultiple, type, defaultValue]);

  useEffect(() => {
    if (type !== "dropdown") return;

    if (isMultiple) {
      if (Array.isArray(defaultValue)) {
        const stillValid = defaultValue.filter((v) =>
          dropdownOptions.includes(v),
        );
        if (stillValid.length !== defaultValue.length) {
          setDefaultValue(stillValid);
        }
      }
    } else {
      if (typeof defaultValue === "string" && defaultValue !== "") {
        if (
          dropdownOptions.length === 0 ||
          !dropdownOptions.includes(defaultValue)
        ) {
          setDefaultValue("");
        }
      }
    }
  }, [dropdownOptions, isMultiple, type, defaultValue]);

  const currentType = CUSTOM_FIELD_TYPES.find((t) => t.value === type);
  const CurrentIcon = currentType?.icon || Type;

  const fieldsToRender = pendingFields ?? customFields;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {customFieldsLoading ? (
          <div className="text-sm text-muted-foreground">
            {t("settings:customFields.loading")}
          </div>
        ) : fieldsToRender.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-border rounded-md bg-sidebar p-4">
            {t("settings:customFields.empty")}
          </div>
        ) : (
          fieldsToRender.map((field, index) => {
            const FieldType = CUSTOM_FIELD_TYPES.find(
              (t) => t.value === field.type,
            );
            const FieldIcon = FieldType?.icon || Type;

            const isDragging = draggedIndex === index;
            const isHovered = draggedIndex !== null && draggedIndex !== index;

            let defaultParsedValues: string[] | null = null;
            let defaultDisplayValue = field.defaultValue ?? "";

            if (field.defaultValue) {
              try {
                const parsed = JSON.parse(field.defaultValue);
                if (Array.isArray(parsed)) {
                  defaultParsedValues = parsed;
                  defaultDisplayValue = parsed.join(", ");
                }
              } catch {}
            }

            const defaultValueCanHover =
              Boolean(field.defaultValue) &&
              (field.type === "dropdown" || field.type === "multiselect") &&
              (defaultParsedValues
                ? defaultParsedValues.length > 0
                : Boolean(defaultDisplayValue));

            return (
              // biome-ignore lint/a11y/useSemanticElements: false positive for role="listitem"
              <div
                key={field.id}
                role="listitem"
                draggable={!isReordering}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-2 p-2 border border-border rounded-md bg-sidebar transition-colors active:cursor-grabbing",
                  isDragging && "opacity-50 cursor-grabbing",
                  isHovered && "bg-sidebar-accent",
                  !isDragging && "hover:bg-sidebar-accent/50",
                )}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FieldIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="min-w-0 max-w-[16rem] truncate text-sm font-medium">
                      {field.name}
                    </span>
                    <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t(`settings:customFields.types.${field.type}`)}
                    </span>
                    {field.required && (
                      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {t("settings:customFields.required")}
                      </span>
                    )}
                    {(field.type === "dropdown" ||
                      field.type === "multiselect") &&
                    field.options?.length ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span className="shrink-0 inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors">
                            {t("settings:customFields.options", {
                              count: field.options.length,
                            })}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent
                          className="w-64 max-w-[calc(100vw-3rem)] overflow-hidden"
                          align="start"
                        >
                          <div className="min-w-0 space-y-1.5">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t(
                                "settings:customFields.availableOptions",
                                "Available options",
                              )}
                            </div>

                            <div className="flex min-w-0 max-h-48 flex-wrap gap-1.5 overflow-y-auto overflow-x-hidden">
                              {field.options.map((option) => (
                                <span
                                  key={`field_${field.id}_option_${option}`}
                                  className="min-w-0 max-w-full whitespace-normal break-all rounded bg-secondary px-2.5 py-1 text-xs"
                                >
                                  {option}
                                </span>
                              ))}
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : null}
                    {field.defaultValue &&
                      (defaultValueCanHover ? (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <span className="shrink-0 inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors">
                              {t("settings:customFields.defaultValues", {
                                count: defaultParsedValues?.length ?? 1,
                              })}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent
                            className="w-64 max-w-[calc(100vw-3rem)] overflow-hidden"
                            align="start"
                          >
                            <div className="min-w-0 space-y-1.5">
                              <div className="text-xs font-medium text-muted-foreground">
                                {t("settings:customFields.defaultLabel")}
                              </div>

                              {defaultParsedValues ? (
                                <div className="flex min-w-0 max-h-48 flex-wrap gap-1.5 overflow-y-auto overflow-x-hidden">
                                  {defaultParsedValues.map((value) => (
                                    <span
                                      key={`field_${field.id}_default_${value}`}
                                      className="min-w-0 max-w-full whitespace-normal break-all rounded bg-secondary px-2.5 py-1 text-xs"
                                    >
                                      {value}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="min-w-0 max-w-full whitespace-normal break-words text-xs text-foreground">
                                  {defaultDisplayValue}
                                </p>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      ) : (
                        <span className="min-w-0 max-w-[12rem] truncate text-xs text-muted-foreground">
                          {t("settings:customFields.defaultLabel")}:{" "}
                          <span className="text-foreground">
                            {defaultDisplayValue}
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deletingField || deletingFieldId === field.id}
                  onClick={() => void handleDelete(field.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="sr-only">
                    {t("settings:customFields.deleteButton")}
                  </span>
                </Button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 w-full">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              title={t("settings:customFields.typePlaceholder")}
            >
              <CurrentIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-1 px-0.5 py-1">
              {CUSTOM_FIELD_TYPES.filter((item) => item.availableOnTask).map(
                (item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.value}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setType(item.value)}
                      className={cn(
                        "w-full justify-start gap-2 text-sm rounded-sm",
                        type === item.value &&
                          "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t(`settings:customFields.types.${item.value}`)}
                    </Button>
                  );
                },
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("settings:customFields.namePlaceholder")}
          className={cn(
            "h-8 text-sm",
            hasExtraInput ? "w-32 flex-[2_0_0]" : "flex-1",
          )}
        />

        {type === "dropdown" && (
          <Input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={t("settings:customFields.optionsPlaceholder")}
            className="h-8 text-sm w-48 flex-[2_0_0]"
          />
        )}

        {type === "date" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-8 w-48 flex-[2_0_0] justify-start bg-background text-left text-sm font-normal",
                  !(typeof defaultValue === "string" && defaultValue) &&
                    "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                {typeof defaultValue === "string" &&
                defaultValue &&
                isValid(parseISO(defaultValue))
                  ? formatDateMedium(parseISO(defaultValue))
                  : t("tasks:detail.pickDate", "Pick a date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={
                  typeof defaultValue === "string" &&
                  defaultValue &&
                  isValid(parseISO(defaultValue))
                    ? parseISO(defaultValue)
                    : undefined
                }
                onSelect={(date) => {
                  setDefaultValue(date ? format(date, "yyyy-MM-dd") : "");
                }}
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>
        )}

        {type === "boolean" ? (
          <div className="inline-flex h-8 w-48 flex-[2_0_0] items-center overflow-hidden rounded-lg border text-xs">
            {(["true", "false"] as const).map((val) => {
              const isSelected = defaultValue === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDefaultValue(val)}
                  className={cn(
                    "flex-1 h-full flex items-center justify-center capitalize transition-colors",
                    isSelected
                      ? "bg-foreground text-background font-medium"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                  aria-pressed={isSelected}
                >
                  {val === "true"
                    ? t("common:boolean.true", "True")
                    : t("common:boolean.false", "False")}
                </button>
              );
            })}
          </div>
        ) : type === "dropdown" ? (
          <>
            <Combobox
              key={isMultiple ? "multi" : "single"}
              multiple={isMultiple}
              autoHighlight
              items={dropdownOptions}
              value={
                isMultiple
                  ? Array.isArray(defaultValue)
                    ? defaultValue
                    : []
                  : typeof defaultValue === "string"
                    ? defaultValue
                    : ""
              }
              onValueChange={(value) => {
                setDefaultValue(isMultiple ? (value ?? []) : (value ?? ""));
              }}
              disabled={dropdownOptions.length === 0}
            >
              <ComboboxChips
                className={cn(
                  "h-8 min-w-0 w-48 flex-[2_0_0] select-none cursor-default",
                  "overflow-hidden",
                  "flex-nowrap",
                )}
              >
                <ComboboxValue>
                  {(values: string[] | string) => {
                    const selected: string[] = isMultiple
                      ? Array.isArray(values)
                        ? values.filter((v) => v !== "")
                        : []
                      : typeof values === "string" && values !== ""
                        ? [values]
                        : [];

                    const MAX_VISIBLE_CHIPS = 3;
                    const visibleChips = selected.slice(0, MAX_VISIBLE_CHIPS);
                    const hiddenCount = selected.length - MAX_VISIBLE_CHIPS;

                    return (
                      <>
                        {visibleChips.map((value) => {
                          if (isMultiple) {
                            return (
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
                            );
                          }
                          return (
                            <div
                              key={value}
                              className={cn(
                                "min-w-0 max-w-full flex-1 shrink basis-0",
                                "inline-flex items-center overflow-hidden",
                                "ps-1.5",
                                "select-none cursor-default",
                              )}
                            >
                              <span className="block min-w-0 max-w-full truncate text-xs">
                                {value}
                              </span>
                            </div>
                          );
                        })}

                        {selected.length > MAX_VISIBLE_CHIPS && (
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
                                {t("settings:customFields.moreOptions", {
                                  hiddenCount,
                                })}
                              </button>
                            </HoverCardTrigger>

                            <HoverCardContent
                              side="top"
                              align="start"
                              className="flex max-w-xs flex-wrap gap-1 overflow-hidden"
                            >
                              <div className="min-w-0 space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {t(
                                    "settings:customFields.availableOptions",
                                    "Available options",
                                  )}
                                </div>

                                <div className="flex min-w-0 max-h-48 flex-wrap gap-x-1.5 gap-y-1.5 overflow-y-auto overflow-x-hidden">
                                  {selected
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
                                        <span className="block min-w-0 max-w-[14rem] truncate text-xs">
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
                            selected.length > 0 && "hidden",
                            "pointer-events-none",
                            "placeholder:text-foreground/50",
                            isMultiple && "text-transparent",
                          )}
                          placeholder={
                            dropdownOptions.length === 0
                              ? t(
                                  "settings:customFields.noOptionsPlaceholder",
                                  "No options",
                                )
                              : selected.length === 0
                                ? t(
                                    "settings:customFields.defaultValuePlaceholder",
                                    "Default value",
                                  )
                                : undefined
                          }
                        />

                        {!isMultiple && !required && selected.length > 0 && (
                          <button
                            type="button"
                            className="ml-auto shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultValue("");
                            }}
                            aria-label={t(
                              "settings:customFields.clearDefault",
                              "Clear",
                            )}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
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
                      <span className="block max-w-38 truncate">{option}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxPopup>
            </Combobox>
            <Checkbox
              id="dropdown-multiple"
              checked={isMultiple}
              onCheckedChange={(checked) => {
                const next = Boolean(checked);
                setIsMultiple(next);
                setDefaultValue(next ? [] : "");
              }}
              className="h-4 w-4"
            />
            <label
              htmlFor="dropdown-multiple"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {t("settings:customFields.multiple")}
            </label>
          </>
        ) : type === "number" ? (
          <Input
            value={typeof defaultValue === "string" ? defaultValue : ""}
            type="number"
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder={t("settings:customFields.defaultValuePlaceholder")}
            className="h-8 text-sm w-48 flex-[2_0_0]"
          />
        ) : (
          type !== "date" && (
            <Input
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder={t("settings:customFields.defaultValuePlaceholder")}
              className="h-8 text-sm w-48 flex-[2_0_0]"
            />
          )
        )}

        <div className="flex items-center gap-2 shrink-0">
          <Checkbox
            id="required-field"
            checked={required}
            onCheckedChange={(checked) => setRequired(Boolean(checked))}
            className="h-4 w-4"
          />
          <label
            htmlFor="required-field"
            className="text-xs text-muted-foreground whitespace-nowrap"
          >
            {t("settings:customFields.required")}
          </label>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={
            !name.trim() ||
            savingField ||
            (required &&
              (Array.isArray(defaultValue)
                ? defaultValue.length === 0
                : !defaultValue)) ||
            (type === "dropdown" &&
              dropdownOptions.length < (isMultiple ? 2 : 1))
          }
          className="h-8 gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("settings:customFields.addButton")}
        </Button>
      </div>
    </div>
  );
}
