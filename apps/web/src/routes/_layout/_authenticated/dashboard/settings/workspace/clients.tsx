import { createFileRoute } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
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
import {
  useClients,
  useCreateClient,
} from "@/hooks/queries/client/use-clients";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/clients",
)({
  component: RouteComponent,
});

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace } = useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const { data: clients = [], isLoading } = useClients(workspaceId);
  const createClient = useCreateClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");

  const handleCreate = async () => {
    try {
      await createClient.mutateAsync({
        workspaceId,
        name: name.trim(),
        cnpj: cnpj.replace(/\D/g, ""),
        email: email.trim() || null,
      });
      setOpen(false);
      setName("");
      setCnpj("");
      setEmail("");
      toast.success(t("settings:workspaceClients.createSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceClients.createError"),
      );
    }
  };

  return (
    <div className="space-y-6 p-1">
      <PageTitle title={t("settings:workspaceClients.title")} />
      <CardFrame>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings:workspaceClients.title")}</CardTitle>
            <CardDescription>
              {t("settings:workspaceClients.description")}
            </CardDescription>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4 mr-1" />
              {t("settings:workspaceClients.add")}
            </Button>
          </CardHeader>
          <CardPanel className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:workspaceClients.loading")}
              </p>
            ) : clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:workspaceClients.empty")}
              </p>
            ) : (
              clients.map((clientRecord) => (
                <div
                  key={clientRecord.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{clientRecord.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCnpj(clientRecord.cnpj)}
                      </p>
                    </div>
                  </div>
                  {clientRecord.email ? (
                    <span className="text-xs text-muted-foreground">
                      {clientRecord.email}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </CardPanel>
        </Card>
      </CardFrame>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings:workspaceClients.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="client-name">
                {t("settings:workspaceClients.name")}
              </Label>
              <Input
                id="client-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-cnpj">
                {t("settings:workspaceClients.cnpj")}
              </Label>
              <Input
                id="client-cnpj"
                value={cnpj}
                onChange={(event) => setCnpj(formatCnpj(event.target.value))}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">
                {t("settings:workspaceClients.email")}
              </Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={
                !name.trim() ||
                cnpj.replace(/\D/g, "").length !== 14 ||
                createClient.isPending
              }
              onClick={() => void handleCreate()}
            >
              {t("settings:workspaceClients.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
