import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createContractTemplate,
  getContractTemplates,
} from "@/fetchers/contract/contract-api";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/contracts",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace } = useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [originalFilename, setOriginalFilename] = useState("");
  const [bodyHtml, setBodyHtml] = useState(
    "<p>Contrato {{cliente.razaoSocial}} (CNPJ {{cliente.cnpj}}).</p>",
  );
  const [fileName, setFileName] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract-templates", workspaceId],
    queryFn: () => getContractTemplates(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: createContractTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["contract-templates", workspaceId],
      });
      setOpen(false);
      setName("");
      setOriginalFilename("");
      setFileName(null);
      setBodyHtml(
        "<p>Contrato {{cliente.razaoSocial}} (CNPJ {{cliente.cnpj}}).</p>",
      );
      toast.success(t("settings:workspaceContracts.createSuccess"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceContracts.createError"),
      );
    },
  });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setOriginalFilename(file.name);
    if (!name.trim()) {
      setName(file.name.replace(/\.[^.]+$/, ""));
    }

    if (
      file.type.startsWith("text/") ||
      file.name.endsWith(".html") ||
      file.name.endsWith(".htm") ||
      file.name.endsWith(".txt")
    ) {
      const text = await file.text();
      setBodyHtml(text.slice(0, 50_000));
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      workspaceId,
      name: name.trim(),
      originalFilename: originalFilename.trim() || fileName || null,
      bodyHtml: bodyHtml.trim() || null,
      mimeType: fileName?.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "text/html",
      sizeBytes: bodyHtml.length,
    });
  };

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
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4 mr-1" />
              {t("settings:workspaceContracts.add")}
            </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("settings:workspaceContracts.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">
                {t("settings:workspaceContracts.name")}
              </Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-file">
                {t("settings:workspaceContracts.upload")}
              </Label>
              <Input
                id="template-file"
                type="file"
                accept=".html,.htm,.txt,.docx,.doc"
                onChange={(event) => void handleFileChange(event)}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings:workspaceContracts.uploadHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-body">
                {t("settings:workspaceContracts.bodyHtml")}
              </Label>
              <Textarea
                id="template-body"
                value={bodyHtml}
                onChange={(event) => setBodyHtml(event.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!name.trim() || createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending
                ? t("settings:workspaceContracts.saving")
                : t("settings:workspaceContracts.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
