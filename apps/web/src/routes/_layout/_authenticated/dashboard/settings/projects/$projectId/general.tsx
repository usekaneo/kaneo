import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import PageTitle from "@/components/page-title";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import icons from "@/constants/project-icons";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/general",
)({
  component: RouteComponent,
});

type ProjectFormValues = {
  name: string;
  slug: string;
  description?: string;
  icon: string;
};

const projectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .min(2, "Project name must be at least 2 characters"),
  slug: z
    .string()
    .min(1, "Key is required")
    .min(2, "Key must be at least 2 characters")
    .max(8, "Key must be at most 8 characters"),
  description: z.string().optional(),
  icon: z.string().min(1, "Icon is required"),
});

function RouteComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);

  const { data: workspace } = useActiveWorkspace();
  const { projectId: rawProjectId } = useParams({ strict: false });
  const projectId = rawProjectId ?? "";
  const { data: project } = useGetProject({
    id: projectId ?? "",
    workspaceId: workspace?.id || "",
  });

  const { mutateAsync: updateProject } = useUpdateProject();
  const { mutateAsync: deleteProject, isPending: isDeleting } =
    useDeleteProject();

  const projectForm = useForm<ProjectFormValues>({
    resolver: standardSchemaResolver(projectSchema),
    mode: "onChange",
    defaultValues: {
      name: project?.name || "",
      slug: project?.slug || "",
      description: project?.description || "",
      icon: project?.icon || "Layout",
    },
  });

  useEffect(() => {
    if (!project) return;
    // Reset form values when project changes without marking as dirty
    projectForm.reset(
      {
        name: project.name || "",
        slug: project.slug || "",
        description: project.description || "",
        icon: project.icon || "Layout",
      },
      { keepDirty: false, keepTouched: false, keepIsValid: true },
    );
  }, [project, projectForm]);

  const saveProject = useCallback(
    async (data: ProjectFormValues) => {
      if (!project?.id) return;

      try {
        await updateProject({
          id: project.id,
          name: data.name.trim(),
          slug: data.slug.trim(),
          description: (data.description ?? "").trim(),
          icon: data.icon || project?.icon || "Layout",
          isPublic: !!project.isPublic,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["projects"] }),
          queryClient.invalidateQueries({
            queryKey: ["projects", workspace?.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["projects", workspace?.id, project.id],
          }),
        ]);
        toast.success("Project updated successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update project",
        );
      }
    },
    [
      project?.id,
      project?.isPublic,
      project?.icon,
      updateProject,
      queryClient,
      workspace?.id,
    ],
  );

  const debouncedSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      const isValid = await projectForm.trigger();
      if (isValid) {
        // Always save latest values to avoid staleness while typing
        const latest = projectForm.getValues();
        saveProject(latest as ProjectFormValues);
      }
    }, 800);
  }, [projectForm, saveProject]);

  useEffect(() => {
    const subscription = projectForm.watch(() => {
      debouncedSave();
    });

    return () => subscription.unsubscribe();
  }, [projectForm, debouncedSave]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteProject = useCallback(async () => {
    if (!project?.id) return;

    try {
      await deleteProject({ id: project.id });
      toast.success("Project deleted successfully");

      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: workspace?.id || "" },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project",
      );
    }
  }, [project?.id, deleteProject, queryClient, navigate, workspace?.id]);

  return (
    <>
      <PageTitle title="Project Settings" />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">General Settings</h1>
          <p className="text-muted-foreground">
            Manage your project name, key, icon and description.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">Project Information</h2>
            <p className="text-xs text-muted-foreground">
              Configure your project details and preferences.
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Icon</p>
                <p className="text-xs text-muted-foreground">
                  Displayed in the sidebar and project surfaces.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Popover
                  open={iconPopoverOpen}
                  onOpenChange={setIconPopoverOpen}
                  modal={true}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-center p-2 rounded border border-border hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                      title="Pick icon"
                    >
                      {(() => {
                        const key =
                          (projectForm.watch("icon") as keyof typeof icons) ||
                          "Layout";
                        const Icon = icons[key] || icons.Layout;
                        return (
                          <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        );
                      })()}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="end">
                    <div className="max-h-[300px] overflow-y-auto">
                      <div className="grid grid-cols-8 gap-2">
                        {Object.entries(icons).map(([iconName, Icon]) => (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => {
                              projectForm.setValue("icon", iconName, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              // Save immediately on icon change
                              const values = projectForm.getValues();
                              void saveProject({
                                ...values,
                                icon: iconName,
                              } as ProjectFormValues);
                              setIconPopoverOpen(false);
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-all duration-200 flex items-center justify-center group hover:scale-105",
                              projectForm.getValues("icon") === iconName
                                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                            )}
                            title={iconName}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            <Form {...projectForm}>
              <form className="space-y-4">
                <FormField
                  control={projectForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">
                            Project name
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            The name of your project
                          </p>
                        </div>
                        <FormControl>
                          <Input
                            className="w-64"
                            placeholder="Enter project name"
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
                  control={projectForm.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">
                            Key
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Used for ticket IDs (e.g.,{" "}
                            {projectForm.watch("slug") || "ABC"}-123)
                          </p>
                        </div>
                        <FormControl>
                          <Input
                            className="w-64"
                            placeholder="PRO"
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
                  control={projectForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">
                            Description
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            A brief description of your project
                          </p>
                        </div>
                        <FormControl>
                          <Input
                            className="w-64"
                            placeholder="Enter project description"
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
            <h2 className="text-md font-medium">Danger zone</h2>
            <p className="text-xs text-muted-foreground">
              Irreversible and destructive actions.
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Delete project</p>
                <p className="text-xs text-muted-foreground">
                  Schedule project to be permanently deleted
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive transition-colors"
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={!project}
              >
                Delete project
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
              <AlertDialogTitle>Delete Project?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the project "{project?.name}" and
                all its data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
