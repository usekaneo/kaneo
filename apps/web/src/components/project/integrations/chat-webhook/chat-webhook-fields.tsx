import type { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { OptionalMarker } from "@/components/project/integrations/delivery-panel/optional-marker";
import { SavedValueInput } from "@/components/project/integrations/delivery-panel/saved-value-input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ChatWebhookFormValues } from "./chat-webhook-form-values";
import type { ChatWebhookProvider } from "./chat-webhook-provider";

type ChatWebhookFieldsProps = {
  control: Control<ChatWebhookFormValues>;
  provider: ChatWebhookProvider;
  connected: boolean;
};

export function ChatWebhookFields({
  control,
  provider,
  connected,
}: ChatWebhookFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField
        control={control}
        name="webhookUrl"
        render={({ field }) => (
          <FormItem className="space-y-1.5 sm:col-span-2">
            <FormLabel>
              {t("settings:chatIntegrations.webhookUrlLabel")}
            </FormLabel>
            <SavedValueInput
              {...field}
              autoComplete="off"
              placeholder={
                connected
                  ? t("settings:chatIntegrations.savedUrlPlaceholder")
                  : t(provider.keys.webhookPlaceholder)
              }
              saved={connected && !field.value}
              type="url"
            />
            {connected ? null : (
              <FormDescription className="text-xs">
                {t(provider.keys.webhookHint)}
              </FormDescription>
            )}
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="channelName"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel>
              {t("settings:chatIntegrations.channelLabel")} <OptionalMarker />
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t("settings:chatIntegrations.channelPlaceholder")}
              />
            </FormControl>
            {connected ? null : (
              <FormDescription className="text-xs">
                {t("settings:chatIntegrations.channelHint")}
              </FormDescription>
            )}
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </div>
  );
}
