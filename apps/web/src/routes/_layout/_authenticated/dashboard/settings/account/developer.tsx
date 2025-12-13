import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import PageTitle from "@/components/page-title";
import { ApiKeyCreatedModal } from "@/components/settings/api-key-created-modal";
import { ApiKeyTable } from "@/components/settings/api-key-table";
import { CreateApiKeyDialog } from "@/components/settings/create-api-key-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import useGetApiKeys from "@/hooks/queries/use-get-api-keys";
import type { CreateApiKeyResponse } from "@/types/api-key";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/developer",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: apiKeys = [], isLoading } = useGetApiKeys();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<{
    key: string;
    name: string;
  } | null>(null);

  const handleCreateSuccess = (data: CreateApiKeyResponse) => {
    setCreatedKey({
      key: data.key,
      name: data.name || "Unnamed Key",
    });
  };

  const handleCreatedModalClose = () => {
    setCreatedKey(null);
  };

  return (
    <>
      <PageTitle title="Developer Settings" />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Developer Settings</h1>
          <p className="text-muted-foreground">
            Manage your API keys and developer resources.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-md font-medium">API Keys</h2>
                <p className="text-xs text-muted-foreground">
                  Create and manage API keys for programmatic access to Kaneo.
                </p>
              </div>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">Create API Key</span>
              </Button>
            </div>
          </div>

          <Separator />

          <ApiKeyTable apiKeys={apiKeys} isLoading={isLoading} />
        </div>
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
