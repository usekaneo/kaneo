import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import labelColors from "@/constants/label-colors";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useDeleteLabel from "@/hooks/mutations/label/use-delete-label";
import useUpdateLabel from "@/hooks/mutations/label/use-update-label";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/labels",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, canManageLabels } = useWorkspacePermission();
  const canEdit = canManageLabels();

  const workspaceId = workspace?.id ?? "";

  const { data: labels = [] } = useGetLabelsByWorkspace(workspaceId);
  const workspaceLabels = labels.filter((label) => !label.taskId);

  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gray");
  const [createError, setCreateError] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("gray");
  const [editError, setEditError] = useState("");

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingLabel, setDeletingLabel] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const resetCreate = () => {
    setNewName("");
    setNewColor("gray");
    setCreateError("");
  };

  const openCreate = () => {
    resetCreate();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError(
        t("settings:workspaceLabels.nameRequired", {
          defaultValue: "Label name is required",
        }),
      );
      return;
    }

    try {
      await createLabel.mutateAsync({
        name: trimmed,
        color: newColor,
        workspaceId,
      });
      toast.success(
        t("settings:workspaceLabels.createSuccess", {
          defaultValue: "Label created",
        }),
      );
      setCreateOpen(false);
      resetCreate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceLabels.createError", {
              defaultValue: "Failed to create label",
            }),
      );
    }
  };

  const openEdit = (label: { id: string; name: string; color: string }) => {
    setEditingLabel(label);
    setEditName(label.name);
    setEditColor(label.color);
    setEditError("");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingLabel) return;

    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError(
        t("settings:workspaceLabels.nameRequired", {
          defaultValue: "Label name is required",
        }),
      );
      return;
    }

    try {
      await updateLabel.mutateAsync({
        id: editingLabel.id,
        name: trimmed,
        color: editColor,
      });
      toast.success(
        t("settings:workspaceLabels.updateSuccess", {
          defaultValue: "Label updated",
        }),
      );
      setEditOpen(false);
      setEditingLabel(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceLabels.updateError", {
              defaultValue: "Failed to update label",
            }),
      );
    }
  };

  const openDelete = (label: { id: string; name: string }) => {
    setDeletingLabel(label);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingLabel) return;

    try {
      await deleteLabel.mutateAsync({ id: deletingLabel.id });
      toast.success(
        t("settings:workspaceLabels.deleteSuccess", {
          defaultValue: "Label deleted",
        }),
      );
      setDeleteOpen(false);
      setDeletingLabel(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceLabels.deleteError", {
              defaultValue: "Failed to delete label",
            }),
      );
    }
  };

  const getColorVar = (colorValue: string) =>
    labelColors.find((c) => c.value === colorValue)?.color ??
    "var(--color-neutral-400)";

  return (
    <>
      <PageTitle title={t("settings:workspaceLabels.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:workspaceLabels.title", { defaultValue: "Labels" })}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:workspaceLabels.subtitle", {
              defaultValue: "Create, edit, and delete workspace-level labels.",
            })}
          </p>
        </div>

        <CardFrame>
          <Card className="!rounded-none !border-t-0">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <Tag className="size-4" />
                {t("settings:workspaceLabels.title", {
                  defaultValue: "Labels",
                })}
              </CardTitle>
              <CardDescription>
                {t("settings:workspaceLabels.cardDescription", {
                  defaultValue: "Manage labels that can be assigned to tasks.",
                })}
              </CardDescription>
              {canEdit && (
                <CardAction>
                  <Button onClick={openCreate} className="gap-2">
                    <Plus className="size-4" />
                    {t("settings:workspaceLabels.createLabel", {
                      defaultValue: "Create Label",
                    })}
                  </Button>
                </CardAction>
              )}
            </CardHeader>
          </Card>

          <Card className="!rounded-none">
            <CardPanel className="p-4">
              {workspaceLabels.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia>
                      <Tag className="size-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {t("settings:workspaceLabels.empty", {
                        defaultValue:
                          "No labels yet. Create your first label to get started.",
                      })}
                    </EmptyTitle>
                    <EmptyDescription />
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="divide-y divide-border">
                  {workspaceLabels.map((label) => (
                    <div
                      key={label.id}
                      className="flex items-center justify-between py-2.5 px-1"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: getColorVar(label.color),
                          }}
                        />
                        <span className="text-sm truncate">{label.name}</span>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t(
                              "settings:workspaceLabels.editLabel",
                              { defaultValue: "Edit Label" },
                            )}
                            className="h-8 w-8"
                            onClick={() =>
                              openEdit({
                                id: label.id,
                                name: label.name,
                                color: label.color,
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t(
                              "settings:workspaceLabels.deleteLabel",
                              { defaultValue: "Delete" },
                            )}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() =>
                              openDelete({
                                id: label.id,
                                name: label.name,
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardPanel>
          </Card>
        </CardFrame>
      </div>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("settings:workspaceLabels.createLabel", {
                defaultValue: "Create Label",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("settings:workspaceLabels.createDescription", {
                defaultValue:
                  "Create a new label that can be used across tasks in this workspace.",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-label-name">
                {t("settings:workspaceLabels.nameLabel", {
                  defaultValue: "Label name",
                })}
              </Label>
              <Input
                id="new-label-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setCreateError("");
                }}
                placeholder={t("settings:workspaceLabels.namePlaceholder", {
                  defaultValue: "Enter label name",
                })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !createLabel.isPending)
                    handleCreate();
                }}
              />
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                {t("settings:workspaceLabels.colorLabel", {
                  defaultValue: "Color",
                })}
              </Label>
              <div className="flex flex-wrap gap-2">
                {labelColors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      newColor === c.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: c.color }}
                    onClick={() => setNewColor(c.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common:actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={handleCreate} disabled={createLabel.isPending}>
              {t("settings:workspaceLabels.createLabel", {
                defaultValue: "Create Label",
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false);
            setEditingLabel(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("settings:workspaceLabels.editLabel", {
                defaultValue: "Edit Label",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("settings:workspaceLabels.editDescription", {
                defaultValue: "Update the name or color of this label.",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-label-name">
                {t("settings:workspaceLabels.nameLabel", {
                  defaultValue: "Label name",
                })}
              </Label>
              <Input
                id="edit-label-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditError("");
                }}
                placeholder={t("settings:workspaceLabels.namePlaceholder", {
                  defaultValue: "Enter label name",
                })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !updateLabel.isPending) handleEdit();
                }}
              />
              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                {t("settings:workspaceLabels.colorLabel", {
                  defaultValue: "Color",
                })}
              </Label>
              <div className="flex flex-wrap gap-2">
                {labelColors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      editColor === c.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: c.color }}
                    onClick={() => setEditColor(c.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditingLabel(null);
              }}
            >
              {t("common:actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={handleEdit} disabled={updateLabel.isPending}>
              {t("settings:workspaceLabels.saveLabel", {
                defaultValue: "Save",
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setDeletingLabel(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:workspaceLabels.deleteConfirmTitle", {
                defaultValue: "Delete this label?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:workspaceLabels.deleteConfirmDescription", {
                defaultValue:
                  "Any tasks using this label will have it removed. This action cannot be undone.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setDeletingLabel(null);
              }}
            >
              {t("common:actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLabel.isPending}
            >
              {t("settings:workspaceLabels.deleteLabel", {
                defaultValue: "Delete",
              })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
