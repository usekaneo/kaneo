import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import PageTitle from "@/components/page-title";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import useDeleteWorkspace from "@/hooks/mutations/workspace/use-delete-workspace";
import useUpdateWorkspace from "@/hooks/mutations/workspace/use-update-workspace";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/general",
)({
  component: RouteComponent,
});

type WorkspaceFormValues = {
  name: string;
  description?: string;
};

type NormalizedWorkspaceValues = {
  name: string;
  description: string;
};

function normalizeWorkspaceValues(
  data: WorkspaceFormValues,
): NormalizedWorkspaceValues {
  return {
    name: data.name.trim(),
    description: (data.description ?? "").trim(),
  };
}

function RouteComponent() {
  const { t } = useTranslation();
  const workspaceSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("settings:workspaceGeneral.validation.nameRequired"))
          .min(2, t("settings:workspaceGeneral.validation.nameShort")),
        description: z.string().optional(),
      }),
    [t],
  );

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<WorkspaceFormValues | null>(null);
  const lastSavedRef = useRef<NormalizedWorkspaceValues | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data: workspace } = useActiveWorkspace();
  const { mutateAsync: updateWorkspace } = useUpdateWorkspace();
  const { mutateAsync: deleteWorkspace, isPending: isDeleting } =
    useDeleteWorkspace();
  const workspaceDescription =
    typeof workspace?.metadata === "object" &&
    workspace?.metadata &&
    "description" in workspace.metadata
      ? String(workspace.metadata.description ?? "")
      : "";

  const workspaceForm = useForm<WorkspaceFormValues>({
    resolver: standardSchemaResolver(workspaceSchema),
    mode: "onChange",
    defaultValues: {
      name: workspace?.name || "",
      description: workspaceDescription,
    },
  });

  useEffect(() => {
    if (!workspace) return;

    const nextValues = {
      name: workspace.name || "",
      description: workspaceDescription,
    };
    lastSavedRef.current = normalizeWorkspaceValues(nextValues);

    if (!workspaceForm.formState.isDirty) {
      workspaceForm.reset(nextValues);
    }
  }, [workspace, workspaceDescription, workspaceForm]);

  const saveWorkspace = useCallback(
    async (data: WorkspaceFormValues) => {
      if (!workspace?.id) return;

      const normalizedData = normalizeWorkspaceValues(data);
      const nameChanged = lastSavedRef.current?.name !== normalizedData.name;
      const descriptionChanged =
        lastSavedRef.current?.description !== normalizedData.description;
      const hasChanges = nameChanged || descriptionChanged;

      if (!hasChanges) return;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;

      try {
        const updatePayload: {
          workspaceId: string;
          name?: string;
          description?: string;
        } = {
          workspaceId: workspace.id,
        };

        if (nameChanged) {
          updatePayload.name = normalizedData.name;
        }

        if (descriptionChanged) {
          updatePayload.description = normalizedData.description;
        }

        await updateWorkspace(updatePayload);

        workspaceForm.reset(normalizedData, { keepDirty: false });
        lastSavedRef.current = normalizedData;
        queuedSaveRef.current = null;

        await queryClient.invalidateQueries({
          queryKey: ["active-organization"],
        });
        toast.success(t("settings:workspaceGeneral.toastUpdated"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("settings:workspaceGeneral.toastUpdateError"),
        );
      } finally {
        isSavingRef.current = false;

        if (queuedSaveRef.current) {
          const queuedData = queuedSaveRef.current;
          queuedSaveRef.current = null;
          await saveWorkspace(queuedData);
        }
      }
    },
    [workspace, updateWorkspace, queryClient, workspaceForm, t],
  );

  const handleDeleteWorkspace = useCallback(async () => {
    if (!workspace?.id) return;

    try {
      await deleteWorkspace({ workspaceId: workspace.id });
      toast.success(t("settings:workspaceGeneral.toastDeleted"));

      // Invalidate all workspace-related queries
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({
        queryKey: ["active-organization"],
      });

      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceGeneral.toastDeleteError"),
      );
    }
  }, [workspace?.id, deleteWorkspace, queryClient, navigate, t]);

  const debouncedSave = useCallback(
    (data: WorkspaceFormValues) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        saveWorkspace(data);
      }, 1000);
    },
    [saveWorkspace],
  );

  useEffect(() => {
    const subscription = workspaceForm.watch(() => {
      if (workspaceForm.formState.isDirty && workspaceForm.formState.isValid) {
        debouncedSave(workspaceForm.getValues());
      }
    });

    return () => subscription.unsubscribe();
  }, [workspaceForm, debouncedSave]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <PageTitle title={t("settings:workspaceGeneral.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:workspaceGeneral.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:workspaceGeneral.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:workspaceGeneral.workspaceInfoTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:workspaceGeneral.workspaceInfoSubtitle")}
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <Form {...workspaceForm}>
              <form className="space-y-4">
                <FormField
                  control={workspaceForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">
                            {t("settings:workspaceGeneral.nameLabel")}
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {t("settings:workspaceGeneral.nameHint")}
                          </p>
                        </div>
                        <FormControl>
                          <Input
                            className="w-64"
                            placeholder={t(
                              "settings:workspaceGeneral.namePlaceholder",
                            )}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={workspaceForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">
                            {t("settings:workspaceGeneral.descriptionLabel")}
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {t("settings:workspaceGeneral.descriptionHint")}
                          </p>
                        </div>
                        <FormControl>
                          <Input
                            className="w-64"
                            placeholder={t(
                              "settings:workspaceGeneral.descriptionPlaceholder",
                            )}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:workspaceGeneral.dangerZone")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:workspaceGeneral.dangerZoneSubtitle")}
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:workspaceGeneral.deleteWorkspace")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:workspaceGeneral.deleteWorkspaceDescription")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive transition-colors"
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                {t("settings:workspaceGeneral.deleteWorkspace")}
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("settings:workspaceGeneral.deleteModalTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings:workspaceGeneral.deleteModalDescription", {
                  name: workspace?.name ?? "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose>
                <Button variant="outline" size="sm">
                  {t("common:actions.cancel")}
                </Button>
              </AlertDialogClose>
              <AlertDialogClose
                onClick={handleDeleteWorkspace}
                disabled={isDeleting}
              >
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting
                    ? t("common:actions.deleting")
                    : t("settings:workspaceGeneral.deleteModalConfirm")}
                </Button>
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
