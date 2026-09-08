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
  useCreateMattermostIntegration,
  useDeleteMattermostIntegration,
  useUpdateMattermostIntegration,
} from "@/hooks/mutations/mattermost-integration/use-mattermost-integration";
import useGetMattermostIntegration from "@/hooks/queries/mattermost-integration/use-get-mattermost-integration";
import { toast } from "@/lib/toast";

type MattermostIntegrationFormValues = {
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
  control: ReturnType<
    typeof useForm<MattermostIntegrationFormValues>
  >["control"];
  name: keyof Pick<
    MattermostIntegrationFormValues,
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

function isValidMattermostWebhookUrl(value: string): boolean {
  return z.url().safeParse(value).success && /^https:\/\/.+/.test(value);
}

export function MattermostIntegrationSettings({
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

  const { data: integration, isLoading } =
    useGetMattermostIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateMattermostIntegration();
  const { mutateAsync: updateIntegration, isPending: isUpdating } =
    useUpdateMattermostIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteMattermostIntegration();

  const normalizedValues = React.useMemo<MattermostIntegrationFormValues>(
    () => ({
      webhookUrl: "",
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

  const form = useForm<MattermostIntegrationFormValues>({
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
  const lastResetKeyRef = React.useRef<string | null>(null);
  const resetKey = `${projectId}:${integration?.id ?? "none"}`;

  React.useEffect(() => {
    if (form.formState.isDirty && lastResetKeyRef.current === resetKey) {
      return;
    }

    reset(normalizedValues);
    lastResetKeyRef.current = resetKey;
  }, [form.formState.isDirty, normalizedValues, reset, resetKey]);

  const isConnected = Boolean(integration?.webhookConfigured);
  const isBusy = isCreating || isUpdating || isDeleting;

  const onSubmit = async (values: MattermostIntegrationFormValues) => {
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
          !isValidMattermostWebhookUrl(trimmedWebhookUrl)
        ) {
          form.setError("webhookUrl", {
            message: t(
              "settings:mattermostIntegration.validation.webhookInvalid",
            ),
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
          !isValidMattermostWebhookUrl(trimmedWebhookUrl)
        ) {
          form.setError("webhookUrl", {
            message: t(
              "settings:mattermostIntegration.validation.webhookInvalid",
            ),
          });
          return;
        }

        await updateIntegration({
          projectId,
          json: {
            webhookUrl: trimmedWebhookUrl || undefined,
            channelName: values.channelName.trim() || null,
            events,
          },
        });
      }

      form.reset({
        ...values,
        webhookUrl: trimmedWebhookUrl,
      });
      toast.success(t("settings:mattermostIntegration.toast.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:mattermostIntegration.toast.saveError"),
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
          ? t("settings:mattermostIntegration.toast.enabled")
          : t("settings:mattermostIntegration.toast.disabled"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:mattermostIntegration.toast.updateError"),
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
      toast.success(t("settings:mattermostIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:mattermostIntegration.toast.removeError"),
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
                    {t("settings:mattermostIntegration.connectionTitle")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings:mattermostIntegration.connectionHint")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isConnected && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>
                      {integration?.isActive
                        ? t("settings:mattermostIntegration.connected")
                        : t("settings:mattermostIntegration.paused")}
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
                    {t("settings:mattermostIntegration.webhookLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder={t(
                        "settings:mattermostIntegration.webhookPlaceholder",
                      )}
                      type="url"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:mattermostIntegration.webhookHint")}
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
                    {t("settings:mattermostIntegration.channelLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        "settings:mattermostIntegration.channelPlaceholder",
                      )}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:mattermostIntegration.channelHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-sidebar p-4">
            <div>
              <h3 className="font-medium">
                {t("settings:mattermostIntegration.eventsTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings:mattermostIntegration.eventsHint")}
              </p>
            </div>

            <EventToggle
              control={form.control}
              label={t("settings:mattermostIntegration.events.taskCreated")}
              name="taskCreated"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:mattermostIntegration.events.taskStatusChanged",
              )}
              name="taskStatusChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:mattermostIntegration.events.taskPriorityChanged",
              )}
              name="taskPriorityChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:mattermostIntegration.events.taskTitleChanged",
              )}
              name="taskTitleChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:mattermostIntegration.events.taskDescriptionChanged",
              )}
              name="taskDescriptionChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:mattermostIntegration.events.taskCommentCreated",
              )}
              name="taskCommentCreated"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isBusy} type="submit">
              {isConnected
                ? t("settings:mattermostIntegration.saveChanges")
                : t("settings:mattermostIntegration.connect")}
            </Button>
            {isConnected && (
              <Button
                disabled={isBusy}
                onClick={handleDelete}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:mattermostIntegration.disconnect")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
