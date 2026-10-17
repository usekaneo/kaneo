import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UnplugIcon, PlugIcon } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CHAT_EVENT_ITEMS } from "@/components/project/integrations/chat-webhook/chat-events";
import { DeliveryActiveRow } from "@/components/project/integrations/delivery-panel/delivery-active-row";
import { DeliveryFooter } from "@/components/project/integrations/delivery-panel/delivery-footer";
import { DeliveryPanelSkeleton } from "@/components/project/integrations/delivery-panel/delivery-panel-skeleton";
import { EventChecklist } from "@/components/project/integrations/event-checklist/event-checklist";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelSection } from "@/components/project/integrations/panel/integration-panel-section";
import { Form, FormField } from "@/components/ui/form";
import {
  useCreateTelegramIntegration,
  useDeleteTelegramIntegration,
  useUpdateTelegramIntegration,
} from "@/hooks/mutations/telegram-integration/use-telegram-integration";
import useGetTelegramIntegration from "@/hooks/queries/telegram-integration/use-get-telegram-integration";
import { toast } from "@/lib/toast";
import { buildTelegramRequest } from "./build-telegram-request";
import { TelegramFields } from "./telegram-fields";
import {
  type TelegramFormValues,
  telegramFormSchema,
  toTelegramFormValues,
} from "./telegram-form-values";
import { TelegramLoadError } from "./telegram-load-error";

const PROVIDER_NAME = "Telegram";

export function TelegramIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const {
    data: integration,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useGetTelegramIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateTelegramIntegration();
  const { mutateAsync: updateIntegration, isPending: isUpdating } =
    useUpdateTelegramIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteTelegramIntegration();
  const normalizedValues = React.useMemo(
    () => toTelegramFormValues(integration),
    [integration],
  );

  const form = useForm<TelegramFormValues>({
    resolver: standardSchemaResolver(telegramFormSchema),
    defaultValues: toTelegramFormValues(null),
  });
  const { reset } = form;
  const lastResetKeyRef = React.useRef<string | null>(null);
  const resetKey = `${projectId}:${integration?.id ?? "none"}`;

  React.useEffect(() => {
    if (form.formState.isDirty && lastResetKeyRef.current === resetKey) {
      return;
    }

    reset(normalizedValues);
    lastResetKeyRef.current = resetKey;
  }, [form.formState.isDirty, normalizedValues, reset, resetKey]);

  const isConnected = Boolean(integration?.botTokenConfigured);
  const isBusy = isCreating || isUpdating || isDeleting;

  const onSubmit = async (values: TelegramFormValues) => {
    const request = buildTelegramRequest(values, isConnected);

    if (request.kind === "invalid") {
      form.setError(request.field, { message: t(request.messageKey) });
      return;
    }

    try {
      if (request.kind === "create") {
        await createIntegration({ projectId, data: request.data });
      } else {
        await updateIntegration({ projectId, json: request.json });
      }

      form.reset({
        ...values,
        botToken: "",
        chatId: values.chatId.trim(),
        threadId: values.threadId.trim(),
      });
      toast.success(t("settings:telegramIntegration.toast.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:telegramIntegration.toast.saveError"),
      );
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    try {
      await updateIntegration({ projectId, json: { isActive: checked } });
      toast.success(
        checked
          ? t("settings:telegramIntegration.toast.enabled")
          : t("settings:telegramIntegration.toast.disabled"),
        { icon: checked ? PlugIcon : UnplugIcon },
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:telegramIntegration.toast.updateError"),
      );
    }
  };

  const handleDisconnect = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset(toTelegramFormValues(null));
      toast.success(t("settings:telegramIntegration.toast.removed"), {
        icon: UnplugIcon,
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:telegramIntegration.toast.removeError"),
      );
      return false;
    }
  };

  if (isLoading) {
    return <DeliveryPanelSkeleton />;
  }

  if (error) {
    return (
      <TelegramLoadError
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    );
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
                title={t("settings:chatIntegrations.activeTitle", {
                  provider: PROVIDER_NAME,
                })}
              />
            ) : null}
            <TelegramFields
              connected={isConnected}
              control={form.control}
              maskedBotToken={integration?.maskedBotToken}
            />
            <FormField
              control={form.control}
              name="events"
              render={({ field }) => (
                <EventChecklist
                  items={CHAT_EVENT_ITEMS}
                  label={t("settings:chatIntegrations.postWhen")}
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
          </IntegrationPanelSection>
          <DeliveryFooter
            busy={isBusy}
            connectLabel={t("settings:telegramIntegration.connect")}
            connected={isConnected}
            disconnectDescription={t(
              "settings:chatIntegrations.disconnectDescription",
              { provider: PROVIDER_NAME },
            )}
            disconnectTitle={t("settings:chatIntegrations.disconnectTitle", {
              provider: PROVIDER_NAME,
            })}
            disconnecting={isDeleting}
            onDisconnect={handleDisconnect}
          />
        </IntegrationPanel>
      </form>
    </Form>
  );
}
