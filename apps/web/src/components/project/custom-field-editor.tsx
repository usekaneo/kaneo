import { format, isValid, parseISO } from "date-fns";
import {
  CalendarIcon,
  CheckSquare,
  Hash,
  List,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { useState } from "react";
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
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);
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

  const hasExtraInput =
    type === "dropdown" || type === "date" || type === "boolean";
  const dropdownOptions = optionsText
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const currentType = CUSTOM_FIELD_TYPES.find((t) => t.value === type);
  const CurrentIcon = currentType?.icon || Type;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {customFieldsLoading ? (
          <div className="text-sm text-muted-foreground">
            {t("settings:customFields.loading")}
          </div>
        ) : customFields.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-border rounded-md bg-sidebar p-4">
            {t("settings:customFields.empty")}
          </div>
        ) : (
          customFields.map((field) => {
            const FieldType = CUSTOM_FIELD_TYPES.find(
              (t) => t.value === field.type,
            );
            const FieldIcon = FieldType?.icon || Type;
            return (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 border border-border rounded-md bg-sidebar hover:bg-sidebar-accent/50 transition-colors"
              >
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
                        <HoverCardContent className="w-64" align="start">
                          <div className="space-y-1.5">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t(
                                "settings:customFields.availableOptions",
                                "Available options",
                              )}
                            </div>
                            <div className="grid auto-cols-min grid-cols-7 gap-1.5">
                              {field.options.map((option) => (
                                <span
                                  key={`field_${field.id}_option_${option}`}
                                  className="inline-flex items-center rounded bg-secondary px-2.5 py-1 text-xs"
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
            value={defaultValue || "false"}
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
            (type === "dropdown" && !optionsText.trim())
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
