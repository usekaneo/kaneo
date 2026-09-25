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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import useCreateCustomField from "@/hooks/mutations/custom-field/use-create-custom-field";
import useDeleteCustomField from "@/hooks/mutations/custom-field/use-delete-custom-field";
import { useReorderCustomFields } from "@/hooks/mutations/custom-field/use-reorder-custom-field";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type CustomFieldType = "text" | "number" | "date" | "dropdown" | "boolean";

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
}> = [
  { value: "text", icon: Type },
  { value: "number", icon: Hash },
  { value: "date", icon: CalendarIcon },
  { value: "dropdown", icon: List },
  { value: "boolean", icon: CheckSquare },
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
  const [defaultValue, setDefaultValue] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [pendingFields, setPendingFields] = useState<
    CustomFieldDefinition[] | null
  >(null);
  const [isReordering, setIsReordering] = useState(false);

  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

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
          ? optionsText
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined;

      await createCustomField({
        projectId,
        name: name.trim(),
        type,
        required,
        defaultValue: defaultValue || undefined,
        options,
      });

      setName("");
      setType("text");
      setRequired(false);
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
          : t("settings:customFields.reorderError", "Failed to reorder fields"),
      );
    } finally {
      setIsReordering(false);
    }
  };

  const hasExtraInput =
    type === "dropdown" || type === "date" || type === "boolean";

  const dropdownOptions = optionsText
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

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
                    <FieldIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {field.name}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t(`settings:customFields.types.${field.type}`)}
                    </span>
                    {field.required && (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {t("settings:customFields.required")}
                      </span>
                    )}
                    {field.type === "dropdown" && field.options?.length ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors">
                            {field.options.length}{" "}
                            {t("settings:customFields.options", "options")}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent
                          className="w-64 max-w-[calc(100vw-3rem)]"
                          align="start"
                        >
                          <div className="space-y-1.5">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t(
                                "settings:customFields.availableOptions",
                                "Available options",
                              )}
                            </div>

                            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                              {field.options.map((option) => (
                                <span
                                  key={`field_${field.id}_option_${option}`}
                                  className="max-w-full whitespace-normal break-words rounded bg-secondary px-2.5 py-1 text-xs"
                                >
                                  {option}
                                </span>
                              ))}
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : null}
                    {field.defaultValue && (
                      <span className="truncate text-xs text-muted-foreground">
                        {t("settings:customFields.defaultLabel")}:{" "}
                        <span className="text-foreground">
                          {field.defaultValue}
                        </span>
                      </span>
                    )}
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
              {CUSTOM_FIELD_TYPES.map((item) => {
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
              })}
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
                  !defaultValue && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                {defaultValue && isValid(parseISO(defaultValue))
                  ? format(parseISO(defaultValue), "dd MMM yyyy")
                  : t("tasks:detail.pickDate", "Pick a date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={
                  defaultValue && isValid(parseISO(defaultValue))
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
          <Select
            value={defaultValue ?? "false"}
            onValueChange={(value) => setDefaultValue(value as string)}
          >
            <SelectTrigger className="h-8 w-48 flex-[2_0_0] text-sm">
              <SelectValue
                placeholder={t("settings:customFields.defaultValuePlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("common:true", "True")}</SelectItem>
              <SelectItem value="false">
                {t("common:false", "False")}
              </SelectItem>
            </SelectContent>
          </Select>
        ) : type === "dropdown" ? (
          <Select
            value={defaultValue}
            onValueChange={(value) => setDefaultValue(value as string)}
            disabled={dropdownOptions.length === 0}
          >
            <SelectTrigger className="h-8 w-48 flex-[2_0_0] text-sm disabled:opacity-50">
              <SelectValue
                placeholder={
                  dropdownOptions.length === 0
                    ? t(
                        "settings:customFields.noOptionsPlaceholder",
                        "No options",
                      )
                    : t(
                        "settings:customFields.defaultValuePlaceholder",
                        "Default value",
                      )
                }
              />
            </SelectTrigger>
            <SelectContent>
              {dropdownOptions.map((option) => (
                <SelectItem key={`field_option_${option}`} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === "number" ? (
          <Input
            value={defaultValue}
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
            (type === "dropdown" && !optionsText.trim()) ||
            (required && !defaultValue)
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
