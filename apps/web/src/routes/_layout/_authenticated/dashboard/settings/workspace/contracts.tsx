import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import {
  Card,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { getContractTemplates } from "@/fetchers/contract/contract-api";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/contracts",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace } = useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract-templates", workspaceId],
    queryFn: () => getContractTemplates(workspaceId),
    enabled: Boolean(workspaceId),
  });

  return (
    <div className="space-y-6 p-1">
      <PageTitle title={t("settings:workspaceContracts.title")} />
      <CardFrame>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings:workspaceContracts.title")}</CardTitle>
            <CardDescription>
              {t("settings:workspaceContracts.description")}
            </CardDescription>
          </CardHeader>
          <CardPanel className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:workspaceContracts.loading")}
              </p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:workspaceContracts.empty")}
              </p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                >
                  <FileText className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.originalFilename}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardPanel>
        </Card>
      </CardFrame>
    </div>
  );
}
