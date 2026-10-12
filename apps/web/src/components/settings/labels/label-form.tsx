import { TagIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LabelColorSwatches } from "@/components/settings/labels/label-color-swatches";
import { LabelPreview } from "@/components/settings/labels/label-preview";
import type { WorkspaceLabel } from "@/components/settings/labels/workspace-label";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useUpdateLabel from "@/hooks/mutations/label/use-update-label";
import { toast } from "@/lib/toast";

type LabelFormProps = {
  label: WorkspaceLabel | null;
  workspaceId: string;
  onClose: () => void;
};

export function LabelForm({ label, workspaceId, onClose }: LabelFormProps) {
  const { t } = useTranslation();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? "gray");
  const [error, setError] = useState("");
  const nameId = useId();
  const errorId = useId();
  const colorId = useId();
  const isEditing = label !== null;
  const isPending = createLabel.isPending || updateLabel.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("settings:workspaceLabels.nameRequired"));
      return;
    }

    try {
      if (label) {
        await updateLabel.mutateAsync({ id: label.id, name: trimmed, color });
        toast.success(t("settings:workspaceLabels.updateSuccess"), {
          icon: TagIcon,
        });
      } else {
        await createLabel.mutateAsync({ name: trimmed, color, workspaceId });
        toast.success(t("settings:workspaceLabels.createSuccess"), {
          icon: TagIcon,
        });
      }
      onClose();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : t(
              isEditing
                ? "settings:workspaceLabels.updateError"
                : "settings:workspaceLabels.createError",
            ),
      );
    }
  };

  return (
    <form className="contents" noValidate onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {t(
            isEditing
              ? "settings:workspaceLabels.editLabel"
              : "settings:workspaceLabels.newLabel",
          )}
        </DialogTitle>
        <DialogDescription>
          {t(
            isEditing
              ? "settings:workspaceLabels.editDescription"
              : "settings:workspaceLabels.createDescription",
          )}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={nameId}>
            {t("settings:workspaceLabels.nameLabel")}
          </Label>
          <Input
            id={nameId}
            value={name}
            placeholder={t("settings:workspaceLabels.namePlaceholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
          {error ? (
            <p id={errorId} className="text-destructive-foreground text-xs">
              {error}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <span id={colorId} className="block font-medium text-sm">
            {t("settings:workspaceLabels.colorLabel")}
          </span>
          <LabelColorSwatches
            value={color}
            onChange={setColor}
            labelledBy={colorId}
          />
        </div>
        <LabelPreview name={name.trim()} color={color} />
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {t(
            isEditing
              ? "settings:workspaceLabels.saveLabel"
              : "settings:workspaceLabels.createLabel",
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
