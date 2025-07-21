import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Lock, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

import { SettingsLayout } from "@/components/settings-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  "/dashboard/workspace/$workspaceId/settings",
)({
  component: SettingsComponent,
});

function SettingsComponent() {
  const navigate = useNavigate();
  const { workspace, setWorkspace } = useWorkspaceStore();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
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

      await queryClient.invalidateQueries({
        queryKey: ["workspaces"],
      });
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

      await queryClient.invalidateQueries({
        queryKey: ["workspaces"],
      });

      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete workspace",
      );
    }
  };

  const isDeleteDisabled = deleteConfirmText !== workspace?.name || isDeleting;

  return (
    <SettingsLayout
      title="Workspace"
      className="pt-4 px-6"
      description="Manage your workspace details and settings"
    >
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-6">
          <div className="p-6 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Workspace Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter workspace name"
                          className="bg-zinc-50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Description
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter workspace description"
                          className="bg-zinc-50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>

        {/* Danger Zone Section */}
        {isOwner && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                  Danger Zone
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Irreversible and destructive actions
                </p>
              </div>
            </div>

            <div className="p-6 bg-red-50/50 dark:bg-red-500/5 rounded-xl border border-red-200 dark:border-red-800/30">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Delete Workspace
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Once you delete a workspace, there is no going back. This
                      will permanently delete all projects, tasks, and data.
                    </p>
                  </div>
                </div>

                {!isDeleteConfirmOpen ? (
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete Workspace
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 bg-white dark:bg-zinc-900/50 rounded-lg border border-red-300 dark:border-red-700">
                    <Alert className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-500/10">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-800 dark:text-red-200">
                        This action cannot be undone. This will permanently
                        delete the <strong>{workspace?.name}</strong> workspace
                        and all of its data.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="delete-confirm-input"
                          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                          Type <strong>{workspace?.name}</strong> to confirm:
                        </label>
                        <Input
                          id="delete-confirm-input"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={workspace?.name}
                          className="border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-400"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsDeleteConfirmOpen(false);
                            setDeleteConfirmText("");
                          }}
                          className="border-zinc-300 dark:border-zinc-700"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteWorkspace}
                          disabled={isDeleteDisabled}
                          className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Delete Workspace"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Permissions Notice */}
        {!isOwner && (
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-800/30">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Limited Access
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Only workspace owners can delete workspaces and modify certain
                  settings.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
