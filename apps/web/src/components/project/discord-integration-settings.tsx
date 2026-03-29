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
  useCreateDiscordIntegration,
  useDeleteDiscordIntegration,
  useUpdateDiscordIntegration,
} from "@/hooks/mutations/discord-integration/use-discord-integration";
import useGetDiscordIntegration from "@/hooks/queries/discord-integration/use-get-discord-integration";
import { toast } from "@/lib/toast";

type DiscordIntegrationFormValues = {
  webhookUrl: string;
  channelName: string;
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
  control: ReturnType<typeof useForm<DiscordIntegrationFormValues>>["control"];
  name: keyof Pick<
    DiscordIntegrationFormValues,
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

function isValidDiscordWebhookUrl(value: string): boolean {
  return (
    z.url().safeParse(value).success &&
    /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[^/]+\/[^/\s]+$/i.test(
      value,
    )
  );
}

export function DiscordIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const schema = React.useMemo(
    () =>
      z.object({
        webhookUrl: z.string(),
        channelName: z.string(),
        taskCreated: z.boolean(),
        taskStatusChanged: z.boolean(),
        taskPriorityChanged: z.boolean(),
        taskTitleChanged: z.boolean(),
        taskDescriptionChanged: z.boolean(),
        taskCommentCreated: z.boolean(),
      }),
    [],
  );

  const { data: integration, isLoading } = useGetDiscordIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateDiscordIntegration();
  const { mutateAsync: updateIntegration, isPending: isUpdating } =
    useUpdateDiscordIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteDiscordIntegration();
  const normalizedValues = React.useMemo<DiscordIntegrationFormValues>(
    () => ({
      webhookUrl: integration?.webhookUrl ?? "",
      channelName: integration?.channelName ?? "",
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

  const form = useForm<DiscordIntegrationFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      webhookUrl: "",
      channelName: "",
      taskCreated: true,
      taskStatusChanged: true,
      taskPriorityChanged: false,
      taskTitleChanged: false,
      taskDescriptionChanged: false,
      taskCommentCreated: true,
    },
  });
  const { reset } = form;

  React.useEffect(() => {
    reset(normalizedValues);
  }, [normalizedValues, reset]);

  const isConnected = Boolean(integration?.webhookConfigured);
  const isBusy = isCreating || isUpdating || isDeleting;

  const onSubmit = async (values: DiscordIntegrationFormValues) => {
    try {
      const trimmedWebhookUrl = values.webhookUrl.trim();
      const events = {
        taskCreated: values.taskCreated,
        taskStatusChanged: values.taskStatusChanged,
        taskPriorityChanged: values.taskPriorityChanged,
        taskTitleChanged: values.taskTitleChanged,
        taskDescriptionChanged: values.taskDescriptionChanged,
        taskCommentCreated: values.taskCommentCreated,
      };

      if (!isConnected) {
        if (
          !trimmedWebhookUrl ||
          !isValidDiscordWebhookUrl(trimmedWebhookUrl)
        ) {
          form.setError("webhookUrl", {
            message: t("settings:discordIntegration.validation.webhookInvalid"),
          });
          return;
        }

        await createIntegration({
          projectId,
          data: {
            webhookUrl: trimmedWebhookUrl,
            channelName: values.channelName || undefined,
            events,
          },
        });
      } else {
        if (trimmedWebhookUrl && !isValidDiscordWebhookUrl(trimmedWebhookUrl)) {
          form.setError("webhookUrl", {
            message: t("settings:discordIntegration.validation.webhookInvalid"),
          });
          return;
        }

        await updateIntegration({
          projectId,
          json: {
            webhookUrl: trimmedWebhookUrl || undefined,
            channelName: values.channelName || undefined,
            events,
          },
        });
      }

      form.reset({
        ...values,
        webhookUrl: trimmedWebhookUrl,
      });
      toast.success(t("settings:discordIntegration.toast.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:discordIntegration.toast.saveError"),
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
          ? t("settings:discordIntegration.toast.enabled")
          : t("settings:discordIntegration.toast.disabled"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:discordIntegration.toast.updateError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({
        webhookUrl: "",
        channelName: "",
        taskCreated: true,
        taskStatusChanged: true,
        taskPriorityChanged: false,
        taskTitleChanged: false,
        taskDescriptionChanged: false,
        taskCommentCreated: true,
      });
      toast.success(t("settings:discordIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:discordIntegration.toast.removeError"),
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

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">
                    {t("settings:discordIntegration.connectionTitle")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings:discordIntegration.connectionHint")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isConnected && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>
                      {integration?.isActive
                        ? t("settings:discordIntegration.connected")
                        : t("settings:discordIntegration.paused")}
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
              name="webhookUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings:discordIntegration.webhookLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder={t(
                        "settings:discordIntegration.webhookPlaceholder",
                      )}
                      type="url"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:discordIntegration.webhookHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channelName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings:discordIntegration.channelLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        "settings:discordIntegration.channelPlaceholder",
                      )}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:discordIntegration.channelHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-sidebar p-4">
            <div>
              <h3 className="font-medium">
                {t("settings:discordIntegration.eventsTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings:discordIntegration.eventsHint")}
              </p>
            </div>

            <EventToggle
              control={form.control}
              label={t("settings:discordIntegration.events.taskCreated")}
              name="taskCreated"
            />
            <EventToggle
              control={form.control}
              label={t("settings:discordIntegration.events.taskStatusChanged")}
              name="taskStatusChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:discordIntegration.events.taskPriorityChanged",
              )}
              name="taskPriorityChanged"
            />
            <EventToggle
              control={form.control}
              label={t("settings:discordIntegration.events.taskTitleChanged")}
              name="taskTitleChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:discordIntegration.events.taskDescriptionChanged",
              )}
              name="taskDescriptionChanged"
            />
            <EventToggle
              control={form.control}
              label={t("settings:discordIntegration.events.taskCommentCreated")}
              name="taskCommentCreated"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isBusy} type="submit">
              {isConnected
                ? t("settings:discordIntegration.saveChanges")
                : t("settings:discordIntegration.connect")}
            </Button>
            {isConnected && (
              <Button
                disabled={isBusy}
                onClick={handleDelete}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:discordIntegration.disconnect")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
