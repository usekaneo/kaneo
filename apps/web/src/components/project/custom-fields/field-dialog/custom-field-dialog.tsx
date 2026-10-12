import { ListPlusIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addOption,
  formFromField,
  getFormIssue,
  moveOption,
  removeOption,
  renameOption,
  setKind,
  setMultiple,
  toCreatePayload,
  toUpdatePayload,
} from "@/components/project/custom-fields/field-dialog/field-form";
import { FieldOptionsEditor } from "@/components/project/custom-fields/field-dialog/field-options-editor";
import { FieldSettingsBox } from "@/components/project/custom-fields/field-dialog/field-settings-box";
import { FieldTypePicker } from "@/components/project/custom-fields/field-dialog/field-type-picker";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { errorMessage } from "@/components/project/error-message";
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
import { Label } from "@/components/ui/label";
import useCreateCustomField from "@/hooks/mutations/custom-field/use-create-custom-field";
import useUpdateCustomField from "@/hooks/mutations/custom-field/use-update-custom-field";
import { toast } from "@/lib/toast";

type CustomFieldDialogProps = {
  projectId: string;
  projectName?: string;
  field: CustomFieldDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function submitLabelKey(editing: boolean, pending: boolean) {
  if (editing) {
    return pending
      ? "settings:customFields.saving"
      : "settings:customFields.save";
  }
  return pending
    ? "settings:customFields.creating"
    : "settings:customFields.createField";
}

export function CustomFieldDialog({
  projectId,
  projectName,
  field,
  open,
  onOpenChange,
}: CustomFieldDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => formFromField(field));
  const { mutateAsync: createField, isPending: creating } =
    useCreateCustomField();
  const { mutateAsync: updateField, isPending: updating } =
    useUpdateCustomField(projectId);
  const typeLabelId = useId();
  const nameId = useId();
  const optionsLabelId = useId();
  const editing = field !== null;
  const pending = creating || updating;
  const issue = getFormIssue(form);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (issue || pending) return;

    try {
      if (field) {
        await updateField({ id: field.id, data: toUpdatePayload(form) });
        toast.success(t("settings:customFields.updateSuccess"));
      } else {
        await createField(toCreatePayload(form, projectId));
        toast.success(t("settings:customFields.createSuccess"), {
          icon: ListPlusIcon,
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          t(
            field
              ? "settings:customFields.updateError"
              : "settings:customFields.createError",
          ),
        ),
      );
    }
  };

  const rename = (from: string, to: string) => {
    const next = renameOption(form, from, to);
    if (next === form) return false;
    setForm(next);
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-120">
        <form className="contents" noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("settings:customFields.editTitle")
                : t("settings:customFields.newTitle")}
            </DialogTitle>
            <DialogDescription>
              {projectName
                ? t("settings:customFields.dialogDescription", {
                    project: projectName,
                  })
                : t("settings:customFields.dialogDescriptionFallback")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-5">
            <div className="space-y-2">
              <p id={typeLabelId} className="text-sm font-medium">
                {t("settings:customFields.typeLabel")}
              </p>
              <FieldTypePicker
                value={form.kind}
                labelledBy={typeLabelId}
                disabled={editing}
                onChange={(kind) =>
                  setForm((current) => setKind(current, kind))
                }
              />
              {editing ? (
                <p className="text-xs text-muted-foreground">
                  {t("settings:customFields.typeLocked")}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={nameId}>
                {t("settings:customFields.nameLabel")}
              </Label>
              <Input
                id={nameId}
                value={form.name}
                autoComplete="off"
                placeholder={t("settings:customFields.namePlaceholder")}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            {form.kind === "dropdown" ? (
              <div className="space-y-2">
                <p id={optionsLabelId} className="text-sm font-medium">
                  {t("settings:customFields.optionsLabel")}
                </p>
                <FieldOptionsEditor
                  options={form.options}
                  labelledBy={optionsLabelId}
                  onAdd={(option) =>
                    setForm((current) => addOption(current, option))
                  }
                  onRename={rename}
                  onRemove={(option) =>
                    setForm((current) => removeOption(current, option))
                  }
                  onMove={(from, to) =>
                    setForm((current) => moveOption(current, from, to))
                  }
                />
              </div>
            ) : null}
            <FieldSettingsBox
              form={form}
              onMultipleChange={(multiple) =>
                setForm((current) => setMultiple(current, multiple))
              }
              onRequiredChange={(required) =>
                setForm((current) => ({ ...current, required }))
              }
              onDefaultChange={(defaults) =>
                setForm((current) => ({ ...current, ...defaults }))
              }
            />
            {issue && issue !== "nameRequired" ? (
              <p className="text-xs text-muted-foreground">
                {t(`settings:customFields.issues.${issue}`)}
              </p>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={issue !== null || pending}>
              {t(submitLabelKey(editing, pending))}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
