import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Lock, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

import {
  DangerZoneSection,
  SettingsLayout,
  SettingsSection,
} from "@/components/settings-layout";
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
import useDeleteWorkspace from "@/hooks/mutations/workspace/use-delete-workspace";
import useUpdateWorkspace from "@/hooks/mutations/workspace/use-update-workspace";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import queryClient from "@/query-client";
import useWorkspaceStore from "@/store/workspace";

const workspaceFormSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  description: z.string().min(1, "Workspace description is required"),
});

type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/settings",
)({
  component: SettingsComponent,
});

function SettingsComponent() {
  const navigate = useNavigate();
  const { workspace, setWorkspace } = useWorkspaceStore();
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const { mutateAsync: updateWorkspace, isPending: isUpdating } =
    useUpdateWorkspace();
  const { mutateAsync: deleteWorkspace, isPending: isDeleting } =
    useDeleteWorkspace();
  const { isOwner } = useWorkspacePermission();

  const form = useForm<WorkspaceFormValues>({
    resolver: standardSchemaResolver(workspaceFormSchema),
    defaultValues: {
      name: workspace?.name || "",
      description: workspace?.description || "",
    },
  });

  const { isDirty } = form.formState;

  const onSubmit = async (values: WorkspaceFormValues) => {
    if (!workspace?.id) return;
    try {
      const updatedWorkspace = await updateWorkspace({
        id: workspace.id,
        name: values.name,
        description: values.description,
      });
      setWorkspace(updatedWorkspace);
      toast.success("Workspace updated successfully");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      form.reset(values);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update workspace",
      );
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace?.id || deleteConfirmText !== workspace.name) return;
    try {
      await deleteWorkspace({ id: workspace.id });
      toast.success("Workspace deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete workspace",
      );
    }
  };

  if (!isOwner) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Manage your workspace configuration and settings
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20">
            <Lock className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="mt-6 text-center">
            <h2 className="text-xl font-semibold">Permission Required</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Only workspace owners can modify workspace settings. Please
              contact the workspace owner if you need to make changes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Workspace"
      description="Manage your workspace details and settings"
      className="pt-4 px-6 overflow-auto"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {isDirty && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                You have unsaved changes
              </span>
            </div>
          </div>
        )}

        {workspace && (
          <SettingsSection
            title="General"
            description="Basic workspace information and configuration"
          >
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-base font-medium">
                        Workspace Name
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter workspace name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="text-base font-medium">
                        Description
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter workspace description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isUpdating || !isDirty}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </SettingsSection>
        )}

        {workspace && (
          <DangerZoneSection
            title="Danger Zone"
            description="Permanently delete your workspace. This action cannot be undone."
          >
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      This action cannot be undone
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>
                        • All projects and tasks will be permanently deleted
                      </li>
                      <li>• All workspace settings will be erased</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="confirm-deletion"
                    className="text-sm font-medium"
                  >
                    Type "{workspace.name}" to confirm deletion
                  </label>
                  <Input
                    id="confirm-deletion"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={workspace.name}
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleDeleteWorkspace}
                  disabled={deleteConfirmText !== workspace.name || isDeleting}
                  variant="destructive"
                  className="w-full gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete Workspace"}
                </Button>
              </div>
            </div>
          </DangerZoneSection>
        )}
      </div>
    </SettingsLayout>
  );
}
