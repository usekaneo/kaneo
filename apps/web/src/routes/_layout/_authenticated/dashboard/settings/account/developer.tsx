import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { ApiKeyCreatedModal } from "@/components/settings/api-key-created-modal";
import { ApiKeyTable } from "@/components/settings/api-key-table";
import { CreateApiKeyDialog } from "@/components/settings/create-api-key-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import useGetApiKeys from "@/hooks/queries/use-get-api-keys";
import type { CreateApiKeyResponse } from "@/types/api-key";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/developer",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { data: apiKeys = [], isLoading } = useGetApiKeys();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<{
    key: string;
    name: string;
  } | null>(null);

  const handleCreateSuccess = (data: CreateApiKeyResponse) => {
    setCreatedKey({
      key: data.key,
      name: data.name || t("settings:developerPage.unnamedKey"),
    });
  };

  const handleCreatedModalClose = () => {
    setCreatedKey(null);
  };

  return (
    <>
      <PageTitle title={t("settings:developerPage.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:developerPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:developerPage.subtitle")}
          </p>
        </div>

        <CardFrame>
          <Card className="!rounded-none !border-t-0">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <KeyRound className="size-4" />
                {t("settings:developerPage.apiKeysCardTitle")}
              </CardTitle>
              <CardDescription>
                {t("settings:developerPage.apiKeysCardDescription")}
              </CardDescription>
              <CardAction>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  {t("settings:developerPage.createApiKey")}
                </Button>
              </CardAction>
            </CardHeader>
          </Card>

          <Card className="!rounded-none">
            <CardPanel className="p-4">
              <ApiKeyTable apiKeys={apiKeys} isLoading={isLoading} />
            </CardPanel>
          </Card>
        </CardFrame>
      </div>

      <CreateApiKeyDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {createdKey && (
        <ApiKeyCreatedModal
          apiKey={createdKey.key}
          keyName={createdKey.name}
          open={true}
          onClose={handleCreatedModalClose}
        />
      )}
    </>
  );
}
