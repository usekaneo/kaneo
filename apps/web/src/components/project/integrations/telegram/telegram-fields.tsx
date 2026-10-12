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
import type { TelegramFormValues } from "./telegram-form-values";

type TelegramFieldsProps = {
  control: Control<TelegramFormValues>;
  connected: boolean;
  maskedBotToken: string | undefined;
};

export function TelegramFields({
  control,
  connected,
  maskedBotToken,
}: TelegramFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField
        control={control}
        name="botToken"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel>
              {t("settings:telegramIntegration.botTokenLabel")}
            </FormLabel>
            <SavedValueInput
              {...field}
              autoComplete="off"
              className={connected ? undefined : "font-mono"}
              placeholder={
                connected
                  ? t("settings:telegramIntegration.botTokenSavedPlaceholder")
                  : t("settings:telegramIntegration.botTokenPlaceholder")
              }
              saved={connected && !field.value}
              type="password"
            />
            <FormDescription className="text-xs">
              {connected
                ? t("settings:telegramIntegration.botTokenHintConfigured", {
                    token: maskedBotToken,
                  })
                : t("settings:telegramIntegration.botTokenHint")}
            </FormDescription>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="chatId"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel>
              {t("settings:telegramIntegration.chatIdLabel")}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                className="font-mono"
                placeholder={t(
                  "settings:telegramIntegration.chatIdPlaceholder",
                )}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="threadId"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel>
              {t("settings:telegramIntegration.threadIdLabel")}{" "}
              <OptionalMarker />
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode="numeric"
                placeholder={t(
                  "settings:telegramIntegration.threadIdPlaceholder",
                )}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="chatLabel"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel>
              {t("settings:telegramIntegration.chatLabelLabel")}{" "}
              <OptionalMarker />
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t(
                  "settings:telegramIntegration.chatLabelPlaceholder",
                )}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </div>
  );
}
