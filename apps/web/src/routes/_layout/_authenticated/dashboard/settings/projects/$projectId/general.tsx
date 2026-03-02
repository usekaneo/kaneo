import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
import { toast } from "@/lib/toast";

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

type NormalizedProjectValues = {
  name: string;
  slug: string;
  description: string;
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

function normalizeProjectValues(
  data: ProjectFormValues,
): NormalizedProjectValues {
  return {
    name: data.name.trim(),
    slug: data.slug.trim(),
    description: (data.description ?? "").trim(),
    icon: data.icon || "Layout",
  };
}

function RouteComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<ProjectFormValues | null>(null);
  const lastSavedRef = useRef<NormalizedProjectValues | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

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

    const nextValues = {
      name: project.name || "",
      slug: project.slug || "",
      description: project.description || "",
      icon: project.icon || "Layout",
    };
    lastSavedRef.current = normalizeProjectValues(nextValues);

    if (projectForm.formState.isDirty) return;

    projectForm.reset(nextValues, {
      keepDirty: false,
      keepTouched: false,
      keepIsValid: true,
    });
  }, [project, projectForm]);

  const saveProject = useCallback(
    async (data: ProjectFormValues) => {
      if (!project?.id) return;

      const normalizedData = normalizeProjectValues(data);
      const nameChanged = lastSavedRef.current?.name !== normalizedData.name;
      const slugChanged = lastSavedRef.current?.slug !== normalizedData.slug;
      const descriptionChanged =
        lastSavedRef.current?.description !== normalizedData.description;
      const iconChanged = lastSavedRef.current?.icon !== normalizedData.icon;
      const hasChanges =
        nameChanged || slugChanged || descriptionChanged || iconChanged;

      if (!hasChanges) return;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;

      try {
        const updatePayload = {
          id: project.id,
          name: nameChanged ? normalizedData.name : project.name,
          slug: slugChanged ? normalizedData.slug : project.slug,
          description: descriptionChanged
            ? normalizedData.description
            : (project.description ?? ""),
          icon: iconChanged ? normalizedData.icon : (project.icon ?? "Layout"),
          isPublic: !!project.isPublic,
        };

        await updateProject(updatePayload);

        projectForm.reset(normalizedData, { keepDirty: false });
        lastSavedRef.current = normalizedData;
        queuedSaveRef.current = null;

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
      } finally {
        isSavingRef.current = false;

        if (queuedSaveRef.current) {
          const queuedData = queuedSaveRef.current;
          queuedSaveRef.current = null;
          await saveProject(queuedData);
        }
      }
    },
    [
      project?.id,
      project?.isPublic,
      project?.name,
      project?.slug,
      project?.description,
      project?.icon,
      updateProject,
      queryClient,
      workspace?.id,
      projectForm,
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
      if (!projectForm.formState.isDirty) return;
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
                  onOpenChange={(open) => {
                    setIconPopoverOpen(open);
                    if (!open) setIconSearch("");
                  }}
                  modal={true}
                >
                  <PopoverTrigger>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-auto justify-start gap-2 font-normal"
                      title="Pick icon"
                    >
                      {(() => {
                        const selectedKey =
                          (projectForm.watch("icon") as keyof typeof icons) ||
                          "Layout";
                        const SelectedIcon = icons[selectedKey] || icons.Layout;
                        return <SelectedIcon className="h-4 w-4" />;
                      })()}
                      <span className="truncate text-xs">
                        {projectForm.watch("icon") || "Layout"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-2">
                      <Input
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        placeholder="Search icons..."
                        className="h-8 text-xs"
                      />
                      <div className="max-h-[280px] overflow-y-auto pr-1">
                        <div className="grid grid-cols-6 gap-1.5">
                          {Object.entries(icons)
                            .filter(([iconName]) =>
                              iconName
                                .toLowerCase()
                                .includes(iconSearch.trim().toLowerCase()),
                            )
                            .map(([iconName, Icon]) => {
                              const isSelected =
                                projectForm.getValues("icon") === iconName;
                              return (
                                <Button
                                  key={iconName}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    projectForm.setValue("icon", iconName, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    setIconPopoverOpen(false);
                                    setIconSearch("");
                                  }}
                                  className={cn(
                                    "h-10 items-center justify-center rounded-md p-0",
                                    isSelected &&
                                      "bg-sidebar-accent text-sidebar-accent-foreground",
                                  )}
                                  title={iconName}
                                >
                                  <Icon className="h-4 w-4" />
                                </Button>
                              );
                            })}
                        </div>
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
              <AlertDialogClose>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </AlertDialogClose>
              <AlertDialogClose
                onClick={handleDeleteProject}
                disabled={isDeleting}
              >
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete Project"}
                </Button>
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
