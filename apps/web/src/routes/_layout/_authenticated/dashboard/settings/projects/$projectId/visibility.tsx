import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/visibility",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
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
      toast.success(t("settings:projectVisibility.toastUpdated"));
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("settings:projectVisibility.toastUpdateError"),
      );
    } finally {
      savingRef.current = false;
    }
  }, [project, updateProject, queryClient, workspace?.id, t]);

  const origin = window.location.origin;

  const publicUrl = project?.id ? `${origin}/public-project/${project.id}` : "";

  return (
    <>
      <PageTitle title={t("settings:projectVisibility.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:projectVisibility.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:projectVisibility.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:projectVisibility.sectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:projectVisibility.sectionSubtitle")}
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  {t("settings:projectVisibility.publicAccess")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings:projectVisibility.publicAccessHint")}
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
                <Label className="text-sm font-medium">
                  {t("settings:projectVisibility.publicUrl")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings:projectVisibility.publicUrlHint")}
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
                      .then(() =>
                        toast.success(
                          t("settings:projectVisibility.copiedToast"),
                        ),
                      );
                  }}
                >
                  {t("settings:projectVisibility.copy")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
