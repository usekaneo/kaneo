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
import type { GenericWebhookFormValues } from "./generic-webhook-form-values";

type GenericWebhookFieldsProps = {
  control: Control<GenericWebhookFormValues>;
  connected: boolean;
  storedSecret: string | null;
};

export function GenericWebhookFields({
  control,
  connected,
  storedSecret,
}: GenericWebhookFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField
        control={control}
        name="webhookUrl"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel>
              {t("settings:genericWebhookIntegration.webhookLabel")}
            </FormLabel>
            <SavedValueInput
              {...field}
              autoComplete="off"
              placeholder={
                connected
                  ? t("settings:chatIntegrations.savedUrlPlaceholder")
                  : t("settings:genericWebhookIntegration.webhookPlaceholder")
              }
              saved={connected && !field.value}
              type="url"
            />
            {connected ? null : (
              <FormDescription className="text-xs">
                {t("settings:genericWebhookIntegration.webhookHint")}
              </FormDescription>
            )}
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="secret"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel>
              {t("settings:genericWebhookIntegration.secretLabel")}{" "}
              <OptionalMarker />
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                autoComplete="off"
                placeholder={t(
                  "settings:genericWebhookIntegration.secretPlaceholder",
                )}
                type="password"
              />
            </FormControl>
            <FormDescription className="text-xs">
              {storedSecret
                ? t("settings:genericWebhookIntegration.secretHintConfigured", {
                    secret: storedSecret,
                  })
                : t("settings:genericWebhookIntegration.secretHint")}
            </FormDescription>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </div>
  );
}
