import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { DeliveryFooter } from "@/components/project/integrations/delivery-panel/delivery-footer";
import { DeliveryPanelSkeleton } from "@/components/project/integrations/delivery-panel/delivery-panel-skeleton";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelSection } from "@/components/project/integrations/panel/integration-panel-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTangledIntegration } from "@/hooks/queries/tangled-integration/use-tangled-integration";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { TangledOutcome } from "./tangled-outcome";

const fields = [
  { key: "baseUrl", label: "settings:tangledIntegration.baseUrl" },
  { key: "repositoryDid", label: "settings:tangledIntegration.repositoryDid" },
  { key: "repositoryId", label: "settings:tangledIntegration.repositoryId" },
  { key: "repositoryUrl", label: "settings:tangledIntegration.repositoryUrl" },
  { key: "webhookSecret", label: "settings:tangledIntegration.secret" },
] as const;
const patterns = [
  "{slug}-{number}",
  "{slug}-{number}-{title}",
  "{number}",
  "{number}-{title}",
  "feature/{slug}-{number}",
  "feature/{number}-{title}",
  "fix/{slug}-{number}",
  "fix/{number}-{title}",
];
const empty = {
  baseUrl: "https://api.tangled.org",
  repositoryDid: "",
  repositoryId: "",
  repositoryUrl: "",
  branchPattern: "{slug}-{number}",
  webhookSecret: "",
  isActive: true,
};

export function TangledIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const { canManageSettings } = useWorkspacePermission();
  const query = useTangledIntegration(projectId);
  const [values, setValues] = useState(empty);
  const [message, setMessage] = useState("");
  const integration = query.data;
  const canEdit = canManageSettings();
  useEffect(() => {
    if (!integration) {
      setValues(empty);
      return;
    }
    setValues({
      baseUrl: integration.baseUrl,
      repositoryDid: integration.repositoryDid,
      repositoryId: integration.repositoryId,
      repositoryUrl: integration.repositoryUrl,
      branchPattern: integration.branchPattern,
      webhookSecret: "",
      isActive: integration.isActive,
    });
  }, [integration]);

  if (query.isLoading) return <DeliveryPanelSkeleton />;
  if (query.isError)
    return (
      <div role="alert">
        <p>{t("settings:tangledIntegration.loadError")}</p>
        <Button type="button" onClick={() => void query.refetch()}>
          {t("settings:tangledIntegration.retry")}
        </Button>
      </div>
    );
  const busy = query.isPending;
  const ready =
    values.baseUrl.trim() &&
    values.repositoryDid.trim() &&
    values.repositoryId.trim() &&
    values.repositoryUrl.trim() &&
    (integration || values.webhookSecret.trim());
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const input = {
      ...values,
      baseUrl: values.baseUrl.trim(),
      repositoryDid: values.repositoryDid.trim(),
      repositoryId: values.repositoryId.trim(),
      repositoryUrl: values.repositoryUrl.trim(),
    };
    const { webhookSecret, ...rest } = input;
    try {
      await query.save(webhookSecret ? { ...rest, webhookSecret } : rest);
      setValues((current) => ({ ...current, webhookSecret: "" }));
      toast.success(t("settings:tangledIntegration.saved"));
    } catch {
      setMessage(t("settings:tangledIntegration.saveError"));
    }
  };
  const disconnect = async () => {
    try {
      await query.disconnect();
      setValues(empty);
      toast.success(t("settings:tangledIntegration.removed"));
      return true;
    } catch {
      setMessage(t("settings:tangledIntegration.removeError"));
      return false;
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)}>
      <IntegrationPanel>
        <IntegrationPanelSection className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("settings:tangledIntegration.instructions")}
          </p>
          {integration && (
            <label className="block space-y-1 text-sm">
              {t("settings:tangledIntegration.webhookUrl")}
              <Input
                aria-label={t("settings:tangledIntegration.webhookUrl")}
                readOnly
                value={integration.webhookUrl}
              />
            </label>
          )}
          {fields.map(({ key, label }) => {
            return (
              <label key={key} className="block space-y-1 text-sm">
                {t(label)}
                <Input
                  aria-label={t(label)}
                  type={key === "webhookSecret" ? "password" : "text"}
                  autoComplete={
                    key === "webhookSecret" ? "new-password" : "off"
                  }
                  value={values[key]}
                  disabled={!canEdit || busy}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            );
          })}
          {integration && (
            <p className="text-sm text-muted-foreground">
              {t("settings:tangledIntegration.secretHint")}
            </p>
          )}
          <label className="block space-y-1 text-sm">
            {t("settings:tangledIntegration.branchPattern")}
            <select
              aria-label={t("settings:tangledIntegration.branchPattern")}
              className="w-full rounded-md border bg-background p-2"
              value={values.branchPattern}
              disabled={!canEdit || busy}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  branchPattern: event.target.value,
                }))
              }
            >
              {patterns.map((pattern) => (
                <option key={pattern} value={pattern}>
                  {pattern}
                </option>
              ))}
            </select>
          </label>
          {integration && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.isActive}
                disabled={!canEdit || busy}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              {t("settings:tangledIntegration.active")}
            </label>
          )}
          {message && <p role="alert">{message}</p>}
          {integration && canEdit && <TangledOutcome projectId={projectId} />}
        </IntegrationPanelSection>
        {canEdit && (
          <DeliveryFooter
            busy={busy || !ready}
            connectLabel={t("settings:tangledIntegration.connect")}
            connected={Boolean(integration)}
            disconnectDescription={t(
              "settings:tangledIntegration.disconnectDescription",
            )}
            disconnectTitle={t("settings:tangledIntegration.disconnectTitle")}
            disconnecting={busy}
            onDisconnect={disconnect}
          />
        )}
      </IntegrationPanel>
    </form>
  );
}
