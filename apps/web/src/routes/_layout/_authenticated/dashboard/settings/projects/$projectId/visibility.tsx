import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/visibility",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = useParams({ strict: false });
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({
    id: projectId || "",
    workspaceId: workspace?.id || "",
  });

  const queryClient = useQueryClient();
  const { mutateAsync: updateProject } = useUpdateProject();
  const savingRef = useRef(false);

  const handleToggle = useCallback(async () => {
    if (!project) return;
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await updateProject({
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description || "",
        icon: project.icon || "Layout",
        isPublic: !project.isPublic,
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
      toast.success("Visibility updated");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to update visibility",
      );
    } finally {
      savingRef.current = false;
    }
  }, [project, updateProject, queryClient, workspace?.id]);

  const origin = window.location.origin;

  const publicUrl = project?.id ? `${origin}/public-project/${project.id}` : "";

  return (
    <>
      <PageTitle title="Project Visibility" />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Visibility</h1>
          <p className="text-muted-foreground">
            Control who can view and access your project.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">Visibility</h2>
            <p className="text-xs text-muted-foreground">
              Toggle public access and share the public URL.
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Public access</Label>
                <p className="text-xs text-muted-foreground">
                  Allow anyone with the URL to view this project
                </p>
              </div>
              <Switch
                checked={!!project?.isPublic}
                onCheckedChange={handleToggle}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Public URL</Label>
                <p className="text-xs text-muted-foreground">
                  Share this link if the project is public
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={publicUrl} className="w-96" />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!publicUrl) return;
                    navigator.clipboard
                      .writeText(publicUrl)
                      .then(() => toast.success("Copied"));
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
