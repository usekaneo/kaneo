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
import icons from "@/constants/project-icons";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Lock } from "lucide-react";
import { createElement, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  slug: z.string().min(1, "Project slug is required"),
  icon: z.string().min(1, "Project icon is required"),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId/settings",
)({
  component: ProjectSettings,
});

function ProjectSettings() {
  const { project, setProject } = useProjectStore();
  const { isOwner } = useWorkspacePermission();
  const [confirmProjectName, setConfirmProjectName] = useState("");
  const { mutateAsync: updateProject, isPending } = useUpdateProject();
  const { mutateAsync: deleteProject, isPending: isDeleting } =
    useDeleteProject();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name ?? "",
      slug: project?.slug ?? "",
      icon: project?.icon ?? "Layout",
    },
  });

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      await updateProject({
        id: project?.id ?? "",
        name: data.name,
        icon: data.icon,
        slug: data.slug,
        description: project?.description ?? "",
      });

      queryClient.invalidateQueries({
        queryKey: ["project", project?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects", project?.workspaceId],
      });

      toast.success("Project updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update project",
      );
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    if (confirmProjectName !== project.name) {
      toast.error("Project name does not match");
      return;
    }

    try {
      await deleteProject({ id: project.id });

      queryClient.invalidateQueries({
        queryKey: ["project", project.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects", project.workspaceId],
      });

      setProject(undefined);
      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: {
          workspaceId: project.workspaceId,
        },
      });

      toast.success("Project deleted successfully");
      setConfirmProjectName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project",
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
              Only workspace owners can modify project settings. Please contact
              the workspace owner if you need to make changes.
            </p>
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
                  params: {
                    workspaceId: project?.workspaceId ?? "",
                    projectId: project?.id ?? "",
                  },
                })
              }
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Project
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTitle title="Project Settings" />
      <div className="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
        <header className="sticky top-0 z-10 flex items-center px-4 h-[65px] bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Project Settings
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
                  Basic project information and settings.
                </p>

                {project ? (
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
                              <FormLabel>Project Name</FormLabel>
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
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Slug</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="bg-white dark:bg-zinc-800/50 font-mono"
                                  maxLength={5}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="icon"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Icon</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[240px] overflow-y-auto p-2 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                                  {Object.entries(icons).map(([name, Icon]) => (
                                    <button
                                      key={name}
                                      type="button"
                                      onClick={() => field.onChange(name)}
                                      className={cn(
                                        "p-3 sm:p-2 rounded-lg transition-colors flex items-center justify-center group",
                                        field.value === name
                                          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                      )}
                                      title={name}
                                    >
                                      <Icon className="w-6 h-6 sm:w-5 sm:h-5" />
                                    </button>
                                  ))}
                                </div>
                                <div className="absolute left-0 right-0 bottom-0 h-8 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent pointer-events-none" />
                              </div>
                            </FormControl>
                            <div className="flex items-center gap-2 mt-2 px-2">
                              {createElement(
                                icons[field.value as keyof typeof icons],
                                {
                                  className: "w-4 h-4 text-zinc-400",
                                },
                              )}
                              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                                {field.value}
                              </span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </form>
                  </Form>
                ) : (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Select a project to view its settings
                  </div>
                )}
              </div>
            </div>

            {project && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="p-4 md:p-6">
                  <h2 className="text-base font-medium text-red-600 dark:text-red-400 mb-1">
                    Danger Zone
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                    Permanently delete your project. This action cannot be
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
                        <li>All tasks will be permanently deleted</li>
                        <li>All task history will be removed</li>
                        <li>Project settings will be erased</li>
                      </ul>
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-project-name"
                        className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5"
                      >
                        Type "{project.name}" to confirm deletion
                      </label>
                      <div className="flex gap-3">
                        <Input
                          value={confirmProjectName}
                          onChange={(e) =>
                            setConfirmProjectName(e.target.value)
                          }
                          placeholder={project.name}
                          className="bg-white dark:bg-zinc-800/50"
                        />
                        <Button
                          onClick={handleDeleteProject}
                          disabled={confirmProjectName !== project.name}
                          className="bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Delete Project"}
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

export default ProjectSettings;
