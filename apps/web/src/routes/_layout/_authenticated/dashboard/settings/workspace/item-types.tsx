import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  Bookmark,
  Boxes,
  Bug,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  FileText,
  Flag,
  Lightbulb,
  ListTodo,
  type LucideIcon,
  Pencil,
  Plus,
  Rocket,
  TriangleAlert,
  Wrench,
  Zap,
} from "lucide-react";
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

const ITEM_TYPE_ICONS: Record<string, LucideIcon> = {
  bookmark: Bookmark,
  bug: Bug,
  "circle-check": CircleCheck,
  "circle-help": CircleHelp,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  flag: Flag,
  lightbulb: Lightbulb,
  "list-todo": ListTodo,
  rocket: Rocket,
  "triangle-alert": TriangleAlert,
  wrench: Wrench,
  zap: Zap,
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/item-types",
)({
  component: ItemTypesSettingsPage,
});

export function ItemTypesSettingsPage() {
  const { t } = useTranslation();
  const { workspace, canManageItemTypes } = useWorkspacePermission();
  const canEdit = canManageItemTypes();
  const workspaceId = workspace?.id ?? "";
  const {
    data: itemTypes,
    error: itemTypesError,
    isError: itemTypesFailed,
    isFetching: itemTypesFetching,
    isLoading: itemTypesLoading,
    refetch: refetchItemTypes,
  } = useGetItemTypes(workspaceId);
  const createItemType = useCreateItemType();
  const updateItemType = useUpdateItemType();
  const archiveItemType = useArchiveItemType();

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
          (itemTypes ?? []).reduce(
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

  const handleRetry = async () => {
    const result = await refetchItemTypes();
    if (result.error) {
      toast.error(
        result.error instanceof Error
          ? result.error.message
          : t("settings:workspaceItemTypes.loadError", {
              defaultValue: "Could not load item types.",
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
              {canEdit && !itemTypesLoading && !itemTypesFailed && (
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
            <CardPanel className="p-4">
              {itemTypesLoading ? (
                <div
                  role="status"
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {t("settings:workspaceItemTypes.loading", {
                    defaultValue: "Loading item types...",
                  })}
                </div>
              ) : itemTypesFailed ? (
                <div
                  role="alert"
                  className="space-y-3 py-8 text-center text-sm"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {t("settings:workspaceItemTypes.loadError", {
                        defaultValue: "Could not load item types.",
                      })}
                    </p>
                    {itemTypesError instanceof Error && (
                      <p className="text-muted-foreground">
                        {itemTypesError.message}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={itemTypesFetching}
                  >
                    {t("settings:workspaceItemTypes.retry", {
                      defaultValue: "Retry",
                    })}
                  </Button>
                </div>
              ) : (
                <ItemTypeList
                  emptyMessage={t("settings:workspaceItemTypes.empty", {
                    defaultValue: "No item types yet.",
                  })}
                  itemTypes={itemTypes ?? []}
                  canEdit={canEdit}
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
              )}
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
        idPrefix="create-item-type"
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
        idPrefix="edit-item-type"
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
                  "Existing tasks keep this type; it will no longer be available for new assignments.",
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

function ItemTypeList({
  emptyMessage,
  itemTypes,
  canEdit,
  onEdit,
  onArchive,
  editLabel,
  archiveLabel,
}: {
  emptyMessage: string;
  itemTypes: ItemType[];
  canEdit: boolean;
  onEdit: (itemType: ItemType) => void;
  onArchive: (itemType: ItemType) => void;
  editLabel: (name: string) => string;
  archiveLabel: (name: string) => string;
}) {
  return (
    <div>
      {itemTypes.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border">
          {itemTypes.map((itemType) => {
            const ItemIcon = ITEM_TYPE_ICONS[itemType.icon] ?? Boxes;

            return (
              <div
                key={itemType.id}
                className="flex items-center justify-between gap-4 px-3 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    title={itemType.icon}
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  >
                    <ItemIcon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {itemType.name}
                      </span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {itemType.key}
                      </code>
                    </div>
                    {itemType.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {itemType.description}
                      </p>
                    )}
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
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
  idPrefix,
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
  idPrefix: string;
}) {
  const { t } = useTranslation();

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
              <Label htmlFor={`${idPrefix}-${field}`}>
                {t(`settings:workspaceItemTypes.${field}Label`, {
                  defaultValue: label,
                })}
              </Label>
              <Input
                id={`${idPrefix}-${field}`}
                value={form[field]}
                onChange={(event) => onChange(field, event.target.value)}
                placeholder={t(
                  `settings:workspaceItemTypes.${field}Placeholder`,
                  { defaultValue: placeholder },
                )}
                aria-invalid={Boolean(errors[field])}
                aria-describedby={
                  errors[field] ? `${idPrefix}-${field}-error` : undefined
                }
              />
              {errors[field] && (
                <p
                  id={`${idPrefix}-${field}-error`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors[field]}
                </p>
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
