import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UnplugIcon, PlugIcon } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DeliveryActiveRow } from "@/components/project/integrations/delivery-panel/delivery-active-row";
import { DeliveryFooter } from "@/components/project/integrations/delivery-panel/delivery-footer";
import { DeliveryPanelSkeleton } from "@/components/project/integrations/delivery-panel/delivery-panel-skeleton";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelSection } from "@/components/project/integrations/panel/integration-panel-section";
import { Form } from "@/components/ui/form";
import {
  useCreateGenericWebhookIntegration,
  useDeleteGenericWebhookIntegration,
  useUpdateGenericWebhookIntegration,
} from "@/hooks/mutations/generic-webhook-integration/use-generic-webhook-integration";
import useGetGenericWebhookIntegration from "@/hooks/queries/generic-webhook-integration/use-get-generic-webhook-integration";
import { toast } from "@/lib/toast";
import { buildGenericWebhookRequest } from "./build-generic-webhook-request";
import { GenericWebhookEventChecklist } from "./generic-webhook-event-checklist";
import { GenericWebhookFields } from "./generic-webhook-fields";
import {
  createGenericWebhookFormSchema,
  type GenericWebhookFormValues,
  toGenericWebhookFormValues,
} from "./generic-webhook-form-values";

export function GenericWebhookIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const schema = React.useMemo(
    () =>
      createGenericWebhookFormSchema(
        t("settings:genericWebhookIntegration.validation.leadTimeRange"),
      ),
    [t],
  );

  const { data: integration, isLoading } =
    useGetGenericWebhookIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGenericWebhookIntegration();
  const { mutateAsync: updateIntegration, isPending: isUpdating } =
    useUpdateGenericWebhookIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGenericWebhookIntegration();

  const normalizedValues = React.useMemo(
    () => toGenericWebhookFormValues(integration),
    [integration],
  );

  const form = useForm<GenericWebhookFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: normalizedValues,
  });
  const { reset } = form;

  React.useEffect(() => {
    reset(normalizedValues);
  }, [normalizedValues, reset]);

  const isConnected = Boolean(integration?.webhookConfigured);
  const isBusy = isCreating || isUpdating || isDeleting;

  const onSubmit = async (values: GenericWebhookFormValues) => {
    const request = buildGenericWebhookRequest(values, isConnected);

    if (request.kind === "invalid") {
      form.setError("webhookUrl", {
        message: t(
          "settings:genericWebhookIntegration.validation.webhookInvalid",
        ),
      });
      return;
    }

    try {
      if (request.kind === "create") {
        await createIntegration({ projectId, data: request.data });
      } else {
        await updateIntegration({ projectId, json: request.json });
      }

      form.reset({ ...values, webhookUrl: "", secret: "" });
      toast.success(t("settings:genericWebhookIntegration.toast.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:genericWebhookIntegration.toast.saveError"),
      );
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    try {
      await updateIntegration({ projectId, json: { isActive: checked } });
      toast.success(
        checked
          ? t("settings:genericWebhookIntegration.toast.enabled")
          : t("settings:genericWebhookIntegration.toast.disabled"),
        { icon: checked ? PlugIcon : UnplugIcon },
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:genericWebhookIntegration.toast.updateError"),
      );
    }
  };

  const handleDisconnect = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset(toGenericWebhookFormValues(null));
      toast.success(t("settings:genericWebhookIntegration.toast.removed"), {
        icon: UnplugIcon,
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:genericWebhookIntegration.toast.removeError"),
      );
      return false;
    }
  };

  if (isLoading) {
    return <DeliveryPanelSkeleton />;
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <IntegrationPanel>
          <IntegrationPanelSection className="space-y-4">
            {isConnected ? (
              <DeliveryActiveRow
                checked={integration?.isActive ?? false}
                description={t("settings:chatIntegrations.activeDescription")}
                disabled={isBusy}
                onCheckedChange={handleToggleActive}
                title={t("settings:genericWebhookIntegration.activeTitle")}
              />
            ) : null}
            <GenericWebhookFields
              connected={isConnected}
              control={form.control}
              storedSecret={
                integration?.secretConfigured
                  ? (integration.maskedSecret ?? "••••")
                  : null
              }
            />
            <GenericWebhookEventChecklist control={form.control} />
          </IntegrationPanelSection>
          <DeliveryFooter
            busy={isBusy}
            connectLabel={t("settings:genericWebhookIntegration.connect")}
            connected={isConnected}
            disconnectDescription={t(
              "settings:genericWebhookIntegration.disconnectDescription",
            )}
            disconnectTitle={t(
              "settings:genericWebhookIntegration.disconnectTitle",
            )}
            disconnecting={isDeleting}
            onDisconnect={handleDisconnect}
          />
        </IntegrationPanel>
      </form>
    </Form>
  );
}
