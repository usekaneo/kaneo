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
  useCreateSlackIntegration,
  useDeleteSlackIntegration,
  useUpdateSlackIntegration,
} from "@/hooks/mutations/slack-integration/use-slack-integration";
import useGetSlackIntegration from "@/hooks/queries/slack-integration/use-get-slack-integration";
import { toast } from "@/lib/toast";

type SlackIntegrationFormValues = {
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
  control: ReturnType<typeof useForm<SlackIntegrationFormValues>>["control"];
  name: keyof Pick<
    SlackIntegrationFormValues,
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

export function SlackIntegrationSettings({ projectId }: { projectId: string }) {
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

  const { data: integration, isLoading } = useGetSlackIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateSlackIntegration();
  const { mutateAsync: updateIntegration, isPending: isUpdating } =
    useUpdateSlackIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteSlackIntegration();
  const normalizedValues = React.useMemo<SlackIntegrationFormValues>(
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

  const form = useForm<SlackIntegrationFormValues>({
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

  React.useEffect(() => {
    form.reset(normalizedValues);
  }, [form, normalizedValues]);

  const isConnected = Boolean(integration?.webhookConfigured);
  const isBusy = isCreating || isUpdating || isDeleting;

  const onSubmit = async (values: SlackIntegrationFormValues) => {
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
          !z.url().safeParse(trimmedWebhookUrl).success
        ) {
          form.setError("webhookUrl", {
            message: t("settings:slackIntegration.validation.webhookInvalid"),
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
        if (
          trimmedWebhookUrl &&
          !z.url().safeParse(trimmedWebhookUrl).success
        ) {
          form.setError("webhookUrl", {
            message: t("settings:slackIntegration.validation.webhookInvalid"),
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
      toast.success(t("settings:slackIntegration.toast.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:slackIntegration.toast.saveError"),
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
          ? t("settings:slackIntegration.toast.enabled")
          : t("settings:slackIntegration.toast.disabled"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:slackIntegration.toast.updateError"),
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
      toast.success(t("settings:slackIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:slackIntegration.toast.removeError"),
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
                    {t("settings:slackIntegration.connectionTitle")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings:slackIntegration.connectionHint")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isConnected && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>
                      {integration?.isActive
                        ? t("settings:slackIntegration.connected")
                        : t("settings:slackIntegration.paused")}
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
                    {t("settings:slackIntegration.webhookLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder={t(
                        "settings:slackIntegration.webhookPlaceholder",
                      )}
                      type="url"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:slackIntegration.webhookHint")}
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
                    {t("settings:slackIntegration.channelLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        "settings:slackIntegration.channelPlaceholder",
                      )}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:slackIntegration.channelHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-sidebar p-4">
            <div>
              <h3 className="font-medium">
                {t("settings:slackIntegration.eventsTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings:slackIntegration.eventsHint")}
              </p>
            </div>

            <EventToggle
              control={form.control}
              label={t("settings:slackIntegration.events.taskCreated")}
              name="taskCreated"
            />
            <EventToggle
              control={form.control}
              label={t("settings:slackIntegration.events.taskStatusChanged")}
              name="taskStatusChanged"
            />
            <EventToggle
              control={form.control}
              label={t("settings:slackIntegration.events.taskPriorityChanged")}
              name="taskPriorityChanged"
            />
            <EventToggle
              control={form.control}
              label={t("settings:slackIntegration.events.taskTitleChanged")}
              name="taskTitleChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:slackIntegration.events.taskDescriptionChanged",
              )}
              name="taskDescriptionChanged"
            />
            <EventToggle
              control={form.control}
              label={t("settings:slackIntegration.events.taskCommentCreated")}
              name="taskCommentCreated"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isBusy} type="submit">
              {isConnected
                ? t("settings:slackIntegration.saveChanges")
                : t("settings:slackIntegration.connect")}
            </Button>
            {isConnected && (
              <Button
                disabled={isBusy}
                onClick={handleDelete}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:slackIntegration.disconnect")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
