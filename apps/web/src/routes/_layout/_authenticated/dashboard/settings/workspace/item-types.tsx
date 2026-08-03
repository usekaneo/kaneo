import { createFileRoute } from "@tanstack/react-router";
import { Archive, Boxes, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useArchiveItemType from "@/hooks/mutations/item-type/use-archive-item-type";
import useCreateItemType from "@/hooks/mutations/item-type/use-create-item-type";
import useUpdateItemType from "@/hooks/mutations/item-type/use-update-item-type";
import useGetItemTypes from "@/hooks/queries/item-type/use-get-item-types";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type { ItemType } from "@/types/item-type";

const ITEM_TYPE_KEY_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

type ItemTypeForm = {
  name: string;
  key: string;
  icon: string;
  description: string;
};

const emptyForm: ItemTypeForm = {
  name: "",
  key: "",
  icon: "",
  description: "",
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/item-types",
)({
  component: ItemTypesSettingsPage,
});

export function ItemTypesSettingsPage() {
  const { t } = useTranslation();
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const { data: itemTypes = [] } = useGetItemTypes(workspaceId);
  const createItemType = useCreateItemType();
  const updateItemType = useUpdateItemType();
  const archiveItemType = useArchiveItemType();

  const activeItemTypes = itemTypes.filter((itemType) => !itemType.archivedAt);
  const archivedItemTypes = itemTypes.filter((itemType) => itemType.archivedAt);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ItemTypeForm>(emptyForm);
  const [createErrors, setCreateErrors] = useState<
    Partial<Record<keyof ItemTypeForm, string>>
  >({});

  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [editForm, setEditForm] = useState<ItemTypeForm>(emptyForm);
  const [editErrors, setEditErrors] = useState<
    Partial<Record<keyof ItemTypeForm, string>>
  >({});
  const [archivingItemType, setArchivingItemType] = useState<ItemType | null>(
    null,
  );

  const validateForm = (form: ItemTypeForm) => {
    const errors: Partial<Record<keyof ItemTypeForm, string>> = {};
    if (!form.name.trim()) {
      errors.name = t("settings:workspaceItemTypes.nameRequired", {
        defaultValue: "Name is required.",
      });
    }
    if (!ITEM_TYPE_KEY_PATTERN.test(form.key.trim())) {
      errors.key = t("settings:workspaceItemTypes.keyInvalid", {
        defaultValue:
          "Use 2-32 lowercase letters, numbers, or hyphens, starting with a letter.",
      });
    }
    if (!form.icon.trim()) {
      errors.icon = t("settings:workspaceItemTypes.iconRequired", {
        defaultValue: "Icon is required.",
      });
    }
    return errors;
  };

  const updateCreateField = (field: keyof ItemTypeForm, value: string) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateEditField = (field: keyof ItemTypeForm, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    setEditErrors((current) => ({ ...current, [field]: undefined }));
  };

  const openCreate = () => {
    setCreateForm(emptyForm);
    setCreateErrors({});
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const errors = validateForm(createForm);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    try {
      await createItemType.mutateAsync({
        workspaceId,
        name: createForm.name.trim(),
        key: createForm.key.trim(),
        icon: createForm.icon.trim(),
        description: createForm.description.trim() || null,
        position:
          itemTypes.reduce(
            (highest, itemType) => Math.max(highest, itemType.position),
            -1,
          ) + 1,
      });
      toast.success(
        t("settings:workspaceItemTypes.createSuccess", {
          defaultValue: "Item type created",
        }),
      );
      setCreateOpen(false);
      setCreateForm(emptyForm);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceItemTypes.createError", {
              defaultValue: "Failed to create item type",
            }),
      );
    }
  };

  const openEdit = (itemType: ItemType) => {
    setEditingItemType(itemType);
    setEditForm({
      name: itemType.name,
      key: itemType.key,
      icon: itemType.icon,
      description: itemType.description ?? "",
    });
    setEditErrors({});
  };

  const handleEdit = async () => {
    if (!editingItemType) return;
    const errors = validateForm(editForm);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      await updateItemType.mutateAsync({
        id: editingItemType.id,
        name: editForm.name.trim(),
        key: editForm.key.trim(),
        icon: editForm.icon.trim(),
        description: editForm.description.trim() || null,
        position: editingItemType.position,
      });
      toast.success(
        t("settings:workspaceItemTypes.updateSuccess", {
          defaultValue: "Item type updated",
        }),
      );
      setEditingItemType(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceItemTypes.updateError", {
              defaultValue: "Failed to update item type",
            }),
      );
    }
  };

  const handleArchive = async () => {
    if (!archivingItemType) return;
    try {
      await archiveItemType.mutateAsync({ id: archivingItemType.id });
      toast.success(
        t("settings:workspaceItemTypes.archiveSuccess", {
          defaultValue: "Item type archived",
        }),
      );
      setArchivingItemType(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceItemTypes.archiveError", {
              defaultValue: "Failed to archive item type",
            }),
      );
    }
  };

  return (
    <>
      <PageTitle
        title={t("settings:workspaceItemTypes.pageTitle", {
          defaultValue: "Item type settings",
        })}
      />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:workspaceItemTypes.title", {
              defaultValue: "Item types",
            })}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:workspaceItemTypes.subtitle", {
              defaultValue:
                "Define the kinds of work your workspace can create and track.",
            })}
          </p>
        </div>

        <CardFrame>
          <Card className="!rounded-none !border-t-0">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <Boxes className="size-4" />
                {t("settings:workspaceItemTypes.title", {
                  defaultValue: "Item types",
                })}
              </CardTitle>
              <CardDescription>
                {t("settings:workspaceItemTypes.cardDescription", {
                  defaultValue:
                    "Manage the names, keys, icons, and descriptions used to classify work.",
                })}
              </CardDescription>
              {isAdmin && (
                <CardAction>
                  <Button onClick={openCreate} className="gap-2">
                    <Plus className="size-4" />
                    {t("settings:workspaceItemTypes.createItemType", {
                      defaultValue: "Create item type",
                    })}
                  </Button>
                </CardAction>
              )}
            </CardHeader>
          </Card>

          <Card className="!rounded-none">
            <CardPanel className="space-y-6 p-4">
              <ItemTypeSection
                title={t("settings:workspaceItemTypes.activeTitle", {
                  defaultValue: "Active item types",
                })}
                emptyMessage={t("settings:workspaceItemTypes.activeEmpty", {
                  defaultValue: "No active item types.",
                })}
                itemTypes={activeItemTypes}
                canEdit={isAdmin}
                onEdit={openEdit}
                onArchive={setArchivingItemType}
                editLabel={(name) =>
                  t("settings:workspaceItemTypes.editItemType", {
                    defaultValue: `Edit ${name}`,
                    name,
                  })
                }
                archiveLabel={(name) =>
                  t("settings:workspaceItemTypes.archiveItemType", {
                    defaultValue: `Archive ${name}`,
                    name,
                  })
                }
              />

              <ItemTypeSection
                title={t("settings:workspaceItemTypes.archivedTitle", {
                  defaultValue: "Archived item types",
                })}
                emptyMessage={t("settings:workspaceItemTypes.archivedEmpty", {
                  defaultValue: "No archived item types.",
                })}
                itemTypes={archivedItemTypes}
                canEdit={false}
                onEdit={openEdit}
                onArchive={setArchivingItemType}
                editLabel={() => ""}
                archiveLabel={() => ""}
              />
            </CardPanel>
          </Card>
        </CardFrame>
      </div>

      <ItemTypeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("settings:workspaceItemTypes.createItemType", {
          defaultValue: "Create item type",
        })}
        description={t("settings:workspaceItemTypes.createDescription", {
          defaultValue:
            "Add a reusable item type for new work in this workspace.",
        })}
        submitLabel={t("settings:workspaceItemTypes.createAction", {
          defaultValue: "Create",
        })}
        form={createForm}
        errors={createErrors}
        onChange={updateCreateField}
        onSubmit={handleCreate}
        isPending={createItemType.isPending}
      />

      <ItemTypeDialog
        open={Boolean(editingItemType)}
        onOpenChange={(open) => !open && setEditingItemType(null)}
        title={t("settings:workspaceItemTypes.editTitle", {
          defaultValue: "Edit item type",
        })}
        description={t("settings:workspaceItemTypes.editDescription", {
          defaultValue:
            "Update how this item type appears across the workspace.",
        })}
        submitLabel={t("settings:workspaceItemTypes.saveAction", {
          defaultValue: "Save changes",
        })}
        form={editForm}
        errors={editErrors}
        onChange={updateEditField}
        onSubmit={handleEdit}
        isPending={updateItemType.isPending}
      />

      <AlertDialog
        open={Boolean(archivingItemType)}
        onOpenChange={(open) => !open && setArchivingItemType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:workspaceItemTypes.archiveConfirmTitle", {
                defaultValue: `Archive ${archivingItemType?.name ?? "item type"}?`,
                name: archivingItemType?.name,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:workspaceItemTypes.archiveConfirmDescription", {
                defaultValue:
                  "Historical tasks keep this item type, but it cannot be assigned to new tasks.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchivingItemType(null)}
            >
              {t("common:actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveItemType.isPending}
            >
              {t("settings:workspaceItemTypes.archiveAction", {
                defaultValue: "Archive",
              })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ItemTypeSection({
  title,
  emptyMessage,
  itemTypes,
  canEdit,
  onEdit,
  onArchive,
  editLabel,
  archiveLabel,
}: {
  title: string;
  emptyMessage: string;
  itemTypes: ItemType[];
  canEdit: boolean;
  onEdit: (itemType: ItemType) => void;
  onArchive: (itemType: ItemType) => void;
  editLabel: (name: string) => string;
  archiveLabel: (name: string) => string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{title}</h2>
      {itemTypes.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border">
          {itemTypes.map((itemType) => (
            <div
              key={itemType.id}
              className="flex items-center justify-between gap-4 px-3 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{itemType.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {itemType.key}
                  </code>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {itemType.description || itemType.icon}
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={editLabel(itemType.name)}
                    onClick={() => onEdit(itemType)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label={archiveLabel(itemType.name)}
                    onClick={() => onArchive(itemType)}
                  >
                    <Archive className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ItemTypeDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  form,
  errors,
  onChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  form: ItemTypeForm;
  errors: Partial<Record<keyof ItemTypeForm, string>>;
  onChange: (field: keyof ItemTypeForm, value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const fieldIdPrefix = submitLabel.toLowerCase().split(" ").join("-");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6 pt-1">
          {(
            [
              ["name", "Name", "Bug"],
              ["key", "Key", "bug"],
              ["icon", "Icon", "bug"],
              ["description", "Description", "Work that needs attention"],
            ] as const
          ).map(([field, label, placeholder]) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={`${fieldIdPrefix}-${field}`}>
                {t(`settings:workspaceItemTypes.${field}Label`, {
                  defaultValue: label,
                })}
              </Label>
              <Input
                id={`${fieldIdPrefix}-${field}`}
                value={form[field]}
                onChange={(event) => onChange(field, event.target.value)}
                placeholder={t(
                  `settings:workspaceItemTypes.${field}Placeholder`,
                  { defaultValue: placeholder },
                )}
                aria-invalid={Boolean(errors[field])}
              />
              {errors[field] && (
                <p className="text-sm text-destructive">{errors[field]}</p>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
