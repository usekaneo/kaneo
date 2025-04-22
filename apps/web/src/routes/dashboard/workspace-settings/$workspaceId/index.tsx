import PageTitle from "@/components/page-title";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const workspaceFormSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  description: z.string().min(1, "workspace description is required"),
});

type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export const Route = createFileRoute(
  "/dashboard/workspace-settings/$workspaceId/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { workspaceId } = Route.useParams();
  const [confirmWorkSpaceName, setConfirmWorkSpaceName] = useState("");
  const { isOwner } = useWorkspacePermission();

  const { workspace, setWorkspace } = useWorkspaceStore();

  const { mutateAsync: updateWorkspace, isPending } = useUpdateWorkspace();
  const { mutateAsync: deleteWorkspace, isPending: isDeleting } =
    useDeleteWorkspace();

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),

    defaultValues: {
      name: workspace?.name ?? "",
      description: workspace?.description ?? "",
    },
  });

  const onSubmit = async (data: WorkspaceFormValues) => {
    try {
      await updateWorkspace({
        id: workspaceId ?? "",
        name: data.name,
        description: data.description ?? "",
      });

      queryClient.invalidateQueries({
        queryKey: [`workspace-${workspaceId}`],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspace?.ownerEmail],
      });

      toast.success("Workspace updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update workspace",
      );
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;

    if (confirmWorkSpaceName !== workspace.name) {
      toast.error("Workspace name does not match");
      return;
    }

    try {
      await deleteWorkspace({
        id: workspace.id,
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace", workspace.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspace?.ownerEmail],
      });

      setWorkspace(undefined);
      navigate({
        to: "/dashboard",
      });

      toast.success("Workspace deleted successfully");
      setConfirmWorkSpaceName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete workspace",
      );
    }
  };

  if (!isOwner) {
    return (
      <div className="flex-1 p-6">
        <PageTitle title="Project Settings" />
        <div className="mt-6 max-w-2xl mx-auto">
          <div className="bg-white dark:bg-zinc-800/50 rounded-lg p-8 shadow-sm border border-zinc-200 dark:border-zinc-700/50 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Permission Required
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
              Only workspace owners can modify workspace settings. Please
              contact the workspace owner if you need to make changes.
            </p>
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId",
                  params: {
                    workspaceId: workspaceId ?? "",
                  },
                })
              }
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTitle title={`${workspace?.name} Settings`} />
      <div className="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
        <header className="sticky top-0 z-10 flex items-center px-4 h-[65px] bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Workspace Settings
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="p-4 md:p-6">
                <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  General Settings
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Basic Workspace information and settings.
                </p>

                {workspace ? (
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Workspace Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="bg-white dark:bg-zinc-800/50"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Workspace description</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="bg-white dark:bg-zinc-800/50 font-mono"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </form>
                  </Form>
                ) : (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Select a Workspace to view its settings
                  </div>
                )}
              </div>
            </div>
            {workspace && isOwner && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="p-4 md:p-6">
                  <h2 className="text-base font-medium text-red-600 dark:text-red-400 mb-1">
                    Danger Zone
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                    Permanently delete your Workspace. This action cannot be
                    undone.
                  </p>

                  <div className="space-y-4">
                    <div className="p-4 bg-red-500/5 border border-red-200 dark:border-red-500/10 rounded-lg">
                      <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
                        <AlertTriangle className="w-5 h-5" />
                        <p className="font-medium">
                          Warning: This action cannot be undone
                        </p>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-600/90 dark:text-red-400/90">
                        <li>All Projects will be permanently deleted</li>
                        <li>All tasks will be removed</li>
                        <li>All task history will be removed</li>
                        <li>Project settings will be erased</li>
                      </ul>
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-project-name"
                        className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5"
                      >
                        Type "{workspace.name}" to confirm deletion
                      </label>
                      <div className="flex gap-3">
                        <Input
                          value={confirmWorkSpaceName}
                          onChange={(e) =>
                            setConfirmWorkSpaceName(e.target.value)
                          }
                          placeholder={workspace.name}
                          className="bg-white dark:bg-zinc-800/50"
                        />
                        <Button
                          onClick={handleDeleteWorkspace}
                          disabled={confirmWorkSpaceName !== workspace.name}
                          className="bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Delete Workspace"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
