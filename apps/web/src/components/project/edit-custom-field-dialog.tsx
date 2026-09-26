import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useUpdateCustomField from "@/hooks/mutations/custom-field/use-update-custom-field";
import { toast } from "@/lib/toast";
import type { CustomFieldDefinition } from "./custom-field-editor";

export default function EditCustomFieldDialog({
  field,
  onClose,
}: {
  field: CustomFieldDefinition;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(field.name);
  const nextOptionKey = useRef(field.options?.length ?? 0);
  const [options, setOptions] = useState(() =>
    (field.options ?? []).map((value, key) => ({
      key,
      originalValue: value as string | undefined,
      hidden: (field.hiddenOptions ?? []).includes(value),
      value,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useUpdateCustomField();
  const hasOptions = field.type === "dropdown" || field.type === "multiselect";
  const normalizedOptions = options.map((option) => option.value.trim());
  const valid =
    name.trim() &&
    (!hasOptions ||
      (options.length >= (field.type === "multiselect" ? 2 : 1) &&
        normalizedOptions.every(Boolean) &&
        new Set(normalizedOptions).size === options.length &&
        (!field.required || options.some((option) => !option.hidden))));

  async function save() {
    if (!valid || isPending) return;
    setError(null);
    try {
      await mutateAsync({
        param: { id: field.id },
        json: {
          name: name.trim(),
          updatedAt: field.updatedAt,
          ...(hasOptions
            ? {
                options: options.map(({ originalValue, value, hidden }) => ({
                  originalValue,
                  hidden,
                  value: value.trim(),
                })),
              }
            : {}),
        },
      });
      toast.success(t("settings:customFields.updateSuccess"));
      onClose();
    } catch {
      setError(t("settings:customFields.updateError"));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogPopup>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("settings:customFields.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings:customFields.editDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="edit-custom-field-name"
                className="text-sm font-medium"
              >
                {t("settings:customFields.namePlaceholder")}
              </label>
              <Input
                id="edit-custom-field-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>
            {hasOptions && (
              <fieldset disabled={isPending} className="space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  {t("settings:customFields.availableOptions")}
                </legend>
                {options.map((option, index) => (
                  <div key={option.key} className="flex items-center gap-2">
                    <Input
                      aria-label={t("settings:customFields.optionLabel", {
                        number: index + 1,
                      })}
                      value={option.value}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((item) =>
                            item.key === option.key
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    {option.hidden && (
                      <span className="text-xs text-muted-foreground">
                        {t("settings:customFields.hidden")}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t(
                        option.hidden
                          ? "settings:customFields.showOption"
                          : "settings:customFields.hideOption",
                        { number: index + 1 },
                      )}
                      title={t(
                        option.hidden
                          ? "settings:customFields.showOption"
                          : "settings:customFields.hideOption",
                        { number: index + 1 },
                      )}
                      onClick={() =>
                        setOptions((current) =>
                          current.map((item) =>
                            item.key === option.key
                              ? { ...item, hidden: !item.hidden }
                              : item,
                          ),
                        )
                      }
                    >
                      {option.hidden ? (
                        <Eye className="size-4" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("settings:customFields.removeOption", {
                        number: index + 1,
                      })}
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((item) => item.key !== option.key),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const key = nextOptionKey.current++;
                    setOptions((current) => [
                      ...current,
                      {
                        key,
                        originalValue: undefined,
                        value: "",
                        hidden: false,
                      },
                    ]);
                  }}
                >
                  <Plus className="size-4" />
                  {t("settings:customFields.addOption")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("settings:customFields.optionsEditHint")}{" "}
                  {t("settings:customFields.hiddenOptionsHint")}
                </p>
              </fieldset>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={onClose}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || isPending}>
              {t("settings:customFields.saveButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
