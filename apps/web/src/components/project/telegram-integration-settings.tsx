import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CheckCircle, Trash2 } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useCreateTelegramIntegration,
  useDeleteTelegramIntegration,
  useUpdateTelegramIntegration,
} from "@/hooks/mutations/telegram-integration/use-telegram-integration";
import useGetTelegramIntegration from "@/hooks/queries/telegram-integration/use-get-telegram-integration";
import { toast } from "@/lib/toast";

type TelegramIntegrationFormValues = {
  botToken: string;
  chatId: string;
  threadId: string;
  chatLabel: string;
  taskCreated: boolean;
  taskStatusChanged: boolean;
  taskPriorityChanged: boolean;
  taskTitleChanged: boolean;
  taskDescriptionChanged: boolean;
  taskCommentCreated: boolean;
};

function EventToggle({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<TelegramIntegrationFormValues>>["control"];
  name: keyof Pick<
    TelegramIntegrationFormValues,
    | "taskCreated"
    | "taskStatusChanged"
    | "taskPriorityChanged"
    | "taskTitleChanged"
    | "taskDescriptionChanged"
    | "taskCommentCreated"
  >;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-md border px-3 py-2">
          <FormLabel className="text-sm font-medium">{label}</FormLabel>
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function isValidTelegramBotToken(value: string): boolean {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(value);
}

function isValidTelegramThreadId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

export function TelegramIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const schema = React.useMemo(
    () =>
      z.object({
        botToken: z.string(),
        chatId: z.string(),
        threadId: z.string(),
        chatLabel: z.string(),
        taskCreated: z.boolean(),
        taskStatusChanged: z.boolean(),
        taskPriorityChanged: z.boolean(),
        taskTitleChanged: z.boolean(),
        taskDescriptionChanged: z.boolean(),
        taskCommentCreated: z.boolean(),
      }),
    [],
  );

  const {
    data: integration,
    isLoading,
    error,
  } = useGetTelegramIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateTelegramIntegration();
  const { mutateAsync: updateIntegration, isPending: isUpdating } =
    useUpdateTelegramIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteTelegramIntegration();
  const normalizedValues = React.useMemo<TelegramIntegrationFormValues>(
    () => ({
      botToken: "",
      chatId: integration?.chatId ?? "",
      threadId: integration?.threadId ? String(integration.threadId) : "",
      chatLabel: integration?.chatLabel ?? "",
      taskCreated: integration?.events?.taskCreated ?? true,
      taskStatusChanged: integration?.events?.taskStatusChanged ?? true,
      taskPriorityChanged: integration?.events?.taskPriorityChanged ?? false,
      taskTitleChanged: integration?.events?.taskTitleChanged ?? false,
      taskDescriptionChanged:
        integration?.events?.taskDescriptionChanged ?? false,
      taskCommentCreated: integration?.events?.taskCommentCreated ?? true,
    }),
    [integration],
  );

  const form = useForm<TelegramIntegrationFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      botToken: "",
      chatId: "",
      threadId: "",
      chatLabel: "",
      taskCreated: true,
      taskStatusChanged: true,
      taskPriorityChanged: false,
      taskTitleChanged: false,
      taskDescriptionChanged: false,
      taskCommentCreated: true,
    },
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

  React.useEffect(() => {
    if (!error) {
      return;
    }

    const detail =
      error instanceof Error
        ? error.message
        : t("settings:telegramIntegration.toast.saveError");
    toast.error(
      `${t("settings:telegramIntegration.toast.saveError")}: ${detail}`,
    );
  }, [error, t]);

  const isConnected = Boolean(integration?.botTokenConfigured);
  const isBusy = isCreating || isUpdating || isDeleting;

  const onSubmit = async (values: TelegramIntegrationFormValues) => {
    try {
      const trimmedBotToken = values.botToken.trim();
      const trimmedChatId = values.chatId.trim();
      const trimmedThreadId = values.threadId.trim();
      const parsedThreadId = trimmedThreadId
        ? Number(trimmedThreadId)
        : undefined;
      const events = {
        taskCreated: values.taskCreated,
        taskStatusChanged: values.taskStatusChanged,
        taskPriorityChanged: values.taskPriorityChanged,
        taskTitleChanged: values.taskTitleChanged,
        taskDescriptionChanged: values.taskDescriptionChanged,
        taskCommentCreated: values.taskCommentCreated,
      };

      if (!trimmedChatId) {
        form.setError("chatId", {
          message: t("settings:telegramIntegration.validation.chatIdRequired"),
        });
        return;
      }

      if (trimmedThreadId && !isValidTelegramThreadId(trimmedThreadId)) {
        form.setError("threadId", {
          message: t("settings:telegramIntegration.validation.threadIdInvalid"),
        });
        return;
      }

      if (!isConnected) {
        if (!trimmedBotToken || !isValidTelegramBotToken(trimmedBotToken)) {
          form.setError("botToken", {
            message: t(
              "settings:telegramIntegration.validation.botTokenInvalid",
            ),
          });
          return;
        }

        await createIntegration({
          projectId,
          data: {
            botToken: trimmedBotToken,
            chatId: trimmedChatId,
            threadId: parsedThreadId,
            chatLabel: values.chatLabel || undefined,
            events,
          },
        });
      } else {
        if (trimmedBotToken && !isValidTelegramBotToken(trimmedBotToken)) {
          form.setError("botToken", {
            message: t(
              "settings:telegramIntegration.validation.botTokenInvalid",
            ),
          });
          return;
        }

        await updateIntegration({
          projectId,
          json: {
            botToken: trimmedBotToken || undefined,
            chatId: trimmedChatId,
            threadId: parsedThreadId ?? null,
            chatLabel: values.chatLabel || null,
            events,
          },
        });
      }

      form.reset({
        ...values,
        botToken: "",
        chatId: trimmedChatId,
        threadId: trimmedThreadId,
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
      await updateIntegration({
        projectId,
        json: { isActive: checked },
      });
      toast.success(
        checked
          ? t("settings:telegramIntegration.toast.enabled")
          : t("settings:telegramIntegration.toast.disabled"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:telegramIntegration.toast.updateError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({
        botToken: "",
        chatId: "",
        threadId: "",
        chatLabel: "",
        taskCreated: true,
        taskStatusChanged: true,
        taskPriorityChanged: false,
        taskTitleChanged: false,
        taskDescriptionChanged: false,
        taskCommentCreated: true,
      });
      toast.success(t("settings:telegramIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:telegramIntegration.toast.removeError"),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    {t("settings:telegramIntegration.connectionTitle")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings:telegramIntegration.connectionHint")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isConnected && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>
                      {integration?.isActive
                        ? t("settings:telegramIntegration.connected")
                        : t("settings:telegramIntegration.paused")}
                    </span>
                  </div>
                )}
                <Switch
                  checked={integration?.isActive ?? false}
                  disabled={!isConnected || isBusy}
                  onCheckedChange={handleToggleActive}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="botToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings:telegramIntegration.botTokenLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder={t(
                        "settings:telegramIntegration.botTokenPlaceholder",
                      )}
                      type="password"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {integration?.botTokenConfigured
                      ? t(
                          "settings:telegramIntegration.botTokenHintConfigured",
                          { token: integration.maskedBotToken },
                        )
                      : t("settings:telegramIntegration.botTokenHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chatId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings:telegramIntegration.chatIdLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        "settings:telegramIntegration.chatIdPlaceholder",
                      )}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:telegramIntegration.chatIdHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="threadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings:telegramIntegration.threadIdLabel")}
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
                  <p className="text-xs text-muted-foreground">
                    {t("settings:telegramIntegration.threadIdHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chatLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings:telegramIntegration.chatLabelLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        "settings:telegramIntegration.chatLabelPlaceholder",
                      )}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:telegramIntegration.chatLabelHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-sidebar p-4">
            <div>
              <h3 className="font-medium">
                {t("settings:telegramIntegration.eventsTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings:telegramIntegration.eventsHint")}
              </p>
            </div>

            <EventToggle
              control={form.control}
              label={t("settings:telegramIntegration.events.taskCreated")}
              name="taskCreated"
            />
            <EventToggle
              control={form.control}
              label={t("settings:telegramIntegration.events.taskStatusChanged")}
              name="taskStatusChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:telegramIntegration.events.taskPriorityChanged",
              )}
              name="taskPriorityChanged"
            />
            <EventToggle
              control={form.control}
              label={t("settings:telegramIntegration.events.taskTitleChanged")}
              name="taskTitleChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:telegramIntegration.events.taskDescriptionChanged",
              )}
              name="taskDescriptionChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:telegramIntegration.events.taskCommentCreated",
              )}
              name="taskCommentCreated"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isBusy} type="submit">
              {isConnected
                ? t("settings:telegramIntegration.saveChanges")
                : t("settings:telegramIntegration.connect")}
            </Button>
            {isConnected && (
              <Button
                disabled={isBusy}
                onClick={handleDelete}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:telegramIntegration.disconnect")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
