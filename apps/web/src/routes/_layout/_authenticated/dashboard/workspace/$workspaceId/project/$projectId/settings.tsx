import { GitHubIntegrationSettings } from "@/components/project/github-integration-settings";
import { TasksImportExport } from "@/components/project/tasks-import-export";
import {
  DangerZoneSection,
  SettingsLayout,
  SettingsSection,
} from "@/components/settings-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import icons from "@/constants/project-icons";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import useGetTasks from "@/hooks/queries/task/use-get-tasks";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  Download,
  Github,
  Globe,
  Key,
  Lock,
  Trash2,
} from "lucide-react";
import { createElement, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  slug: z.string().min(1, "Project slug is required"),
  icon: z.string().min(1, "Project icon is required"),
  isPublic: z.boolean().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/settings",
)({
  component: ProjectSettings,
});

function ProjectSettings() {
  const { projectId } = Route.useParams();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const { isOwner } = useWorkspacePermission();
  const [confirmProjectName, setConfirmProjectName] = useState("");
  const [copied, setCopied] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const { mutateAsync: updateProject, isPending } = useUpdateProject();
  const { mutateAsync: deleteProject, isPending: isDeleting } =
    useDeleteProject();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<ProjectFormValues>({
    resolver: standardSchemaResolver(projectFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      icon: "Layout",
      isPublic: false,
    },
  });

  const { isDirty } = form.formState;

  const resetFormWithProject = useCallback(
    (projectData: typeof project) => {
      if (projectData) {
        form.reset({
          name: projectData.name || "",
          slug: projectData.slug || "",
          icon: projectData.icon || "Layout",
          isPublic: projectData.isPublic || false,
        });
      }
    },
    [form],
  );

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  useEffect(() => {
    resetFormWithProject(project);
  }, [project, resetFormWithProject]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      await updateProject({
        id: project?.id ?? "",
        name: data.name,
        icon: data.icon,
        slug: data.slug,
        description: project?.description ?? "",
        isPublic: data.isPublic ?? false,
      });

      queryClient.invalidateQueries({
        queryKey: ["project", project?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects", project?.workspaceId],
      });

      form.reset(data);
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

  const handleCopyUrl = async () => {
    if (!project?.id) return;

    const url = `${window.location.origin}/public-project/${project.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy URL");
    }
  };

  if (!isOwner) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Manage your project configuration and settings
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20">
            <Lock className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="mt-6 text-center">
            <h2 className="text-xl font-semibold">Permission Required</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Only workspace owners can modify project settings. Please contact
              the workspace owner if you need to make changes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Project"
      description="Configure your project settings and details"
      className="pt-4 px-6 overflow-auto"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                You have unsaved changes
              </span>
            </div>
          </motion.div>
        )}

        {project && (
          <SettingsSection
            title="General"
            description="Basic project information and configuration"
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
                        Project Name
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter project name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel className="text-base font-medium">
                          Project Icon
                        </FormLabel>
                        <div className="flex items-center gap-4">
                          <Popover
                            open={iconPopoverOpen}
                            onOpenChange={setIconPopoverOpen}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 w-10 p-0"
                              >
                                {createElement(
                                  icons[field.value as keyof typeof icons],
                                  {
                                    className: "h-4 w-4",
                                  },
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-2" align="start">
                              <div className="max-h-[300px] overflow-y-auto">
                                <div className="grid grid-cols-8 gap-2">
                                  {Object.entries(icons).map(
                                    ([iconName, Icon]) => (
                                      <Button
                                        key={iconName}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          "h-10 w-10 p-0",
                                          field.value === iconName &&
                                            "bg-accent",
                                        )}
                                        onClick={() => {
                                          field.onChange(iconName);
                                          setIconPopoverOpen(false);
                                        }}
                                      >
                                        <Icon className="h-4 w-4" />
                                      </Button>
                                    ),
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <div className="flex-1 space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Choose an icon to represent your project
                            </p>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel className="text-base font-medium">
                          Project Key
                        </FormLabel>
                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex items-center gap-3">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="PROJ"
                                className="w-20 border-0 bg-transparent p-0 text-center font-mono text-sm font-semibold uppercase shadow-none focus-visible:ring-0"
                                maxLength={5}
                                onChange={(e) =>
                                  field.onChange(e.target.value.toUpperCase())
                                }
                              />
                            </FormControl>
                            <div className="flex-1 text-xs text-muted-foreground">
                              Used for task IDs (e.g., {field.value || "ABC"}
                              -123)
                            </div>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <FormLabel className="text-base font-medium">
                                Public Project
                              </FormLabel>
                            </div>
                            <FormDescription>
                              Make the project visible to everyone on the web
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                        {field.value && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-4 space-y-3 rounded-md border bg-muted/20 p-3"
                          >
                            <p className="text-sm font-medium">Public URL</p>
                            <div className="flex gap-2">
                              <Input
                                value={`${window.location.origin}/public-project/${project?.id}`}
                                readOnly
                                className="flex-1 font-mono text-xs"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-auto"
                                onClick={handleCopyUrl}
                              >
                                {copied ? (
                                  <>
                                    <Check className="mr-1 h-3 w-3" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="mr-1 h-3 w-3" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isPending || !isDirty}>
                    {isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </SettingsSection>
        )}

        {project && (
          <SettingsSection
            title="Export & Import"
            description="Export tasks to a JSON file or import tasks from a JSON file"
            icon={<Download className="w-4 h-4" />}
          >
            <TasksImportExport project={project} />
          </SettingsSection>
        )}

        {project && (
          <SettingsSection
            title="GitHub Integration"
            description="Configure GitHub integration for your project"
            icon={<Github className="w-4 h-4" />}
          >
            <GitHubIntegrationSettings projectId={project.id} />
          </SettingsSection>
        )}

        {project && (
          <DangerZoneSection
            title="Danger Zone"
            description="Permanently delete your project. This action cannot be undone."
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
                      <li>• All tasks will be permanently deleted</li>
                      <li>• All task history will be removed</li>
                      <li>• Project settings will be erased</li>
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
                    Type "{project.name}" to confirm deletion
                  </label>
                  <Input
                    id="confirm-deletion"
                    value={confirmProjectName}
                    onChange={(e) => setConfirmProjectName(e.target.value)}
                    placeholder={project.name}
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleDeleteProject}
                  disabled={confirmProjectName !== project.name || isDeleting}
                  variant="destructive"
                  className="w-full gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete Project"}
                </Button>
              </div>
            </div>
          </DangerZoneSection>
        )}
      </div>
    </SettingsLayout>
  );
}

export default ProjectSettings;
