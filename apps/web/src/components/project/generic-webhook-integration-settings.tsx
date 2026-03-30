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
  useCreateGenericWebhookIntegration,
  useDeleteGenericWebhookIntegration,
  useUpdateGenericWebhookIntegration,
} from "@/hooks/mutations/generic-webhook-integration/use-generic-webhook-integration";
import useGetGenericWebhookIntegration from "@/hooks/queries/generic-webhook-integration/use-get-generic-webhook-integration";
import { toast } from "@/lib/toast";

type GenericWebhookIntegrationFormValues = {
  webhookUrl: string;
  secret: string;
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
    typeof useForm<GenericWebhookIntegrationFormValues>
  >["control"];
  name: keyof Pick<
    GenericWebhookIntegrationFormValues,
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

export function GenericWebhookIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const schema = React.useMemo(
    () =>
      z.object({
        webhookUrl: z.string(),
        secret: z.string(),
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
    useGetGenericWebhookIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGenericWebhookIntegration();
  const { mutateAsync: updateIntegration, isPending: isUpdating } =
    useUpdateGenericWebhookIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGenericWebhookIntegration();

  const normalizedValues = React.useMemo<GenericWebhookIntegrationFormValues>(
    () => ({
      webhookUrl: integration?.webhookUrl ?? "",
      secret: "",
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

  const form = useForm<GenericWebhookIntegrationFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: normalizedValues,
  });
  const { reset } = form;

  React.useEffect(() => {
    reset(normalizedValues);
  }, [normalizedValues, reset]);

  const isConnected = Boolean(integration?.webhookConfigured);
  const isBusy = isCreating || isUpdating || isDeleting;

  const onSubmit = async (values: GenericWebhookIntegrationFormValues) => {
    try {
      const trimmedWebhookUrl = values.webhookUrl.trim();
      const trimmedSecret = values.secret.trim();
      const events = {
        taskCreated: values.taskCreated,
        taskStatusChanged: values.taskStatusChanged,
        taskPriorityChanged: values.taskPriorityChanged,
        taskTitleChanged: values.taskTitleChanged,
        taskDescriptionChanged: values.taskDescriptionChanged,
        taskCommentCreated: values.taskCommentCreated,
      };

      if (!trimmedWebhookUrl || !z.url().safeParse(trimmedWebhookUrl).success) {
        form.setError("webhookUrl", {
          message: t(
            "settings:genericWebhookIntegration.validation.webhookInvalid",
          ),
        });
        return;
      }

      if (!isConnected) {
        await createIntegration({
          projectId,
          data: {
            webhookUrl: trimmedWebhookUrl,
            secret: trimmedSecret || undefined,
            events,
          },
        });
      } else {
        await updateIntegration({
          projectId,
          json: {
            webhookUrl: trimmedWebhookUrl,
            secret: trimmedSecret || undefined,
            events,
          },
        });
      }

      form.reset({
        ...values,
        webhookUrl: trimmedWebhookUrl,
        secret: "",
      });
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
      await updateIntegration({
        projectId,
        json: { isActive: checked },
      });
      toast.success(
        checked
          ? t("settings:genericWebhookIntegration.toast.enabled")
          : t("settings:genericWebhookIntegration.toast.disabled"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:genericWebhookIntegration.toast.updateError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({
        webhookUrl: "",
        secret: "",
        taskCreated: true,
        taskStatusChanged: true,
        taskPriorityChanged: false,
        taskTitleChanged: false,
        taskDescriptionChanged: false,
        taskCommentCreated: true,
      });
      toast.success(t("settings:genericWebhookIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:genericWebhookIntegration.toast.removeError"),
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
                <h3 className="font-medium">
                  {t("settings:genericWebhookIntegration.connectionTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("settings:genericWebhookIntegration.connectionHint")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isConnected && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>
                      {integration?.isActive
                        ? t("settings:genericWebhookIntegration.connected")
                        : t("settings:genericWebhookIntegration.paused")}
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
                    {t("settings:genericWebhookIntegration.webhookLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder={t(
                        "settings:genericWebhookIntegration.webhookPlaceholder",
                      )}
                      type="url"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t("settings:genericWebhookIntegration.webhookHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings:genericWebhookIntegration.secretLabel")}
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
                  <p className="text-xs text-muted-foreground">
                    {integration?.secretConfigured
                      ? t(
                          "settings:genericWebhookIntegration.secretHintConfigured",
                          { secret: integration.maskedSecret ?? "••••" },
                        )
                      : t("settings:genericWebhookIntegration.secretHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-sidebar p-4">
            <div>
              <h3 className="font-medium">
                {t("settings:genericWebhookIntegration.eventsTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings:genericWebhookIntegration.eventsHint")}
              </p>
            </div>

            <EventToggle
              control={form.control}
              label={t("settings:genericWebhookIntegration.events.taskCreated")}
              name="taskCreated"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:genericWebhookIntegration.events.taskStatusChanged",
              )}
              name="taskStatusChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:genericWebhookIntegration.events.taskPriorityChanged",
              )}
              name="taskPriorityChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:genericWebhookIntegration.events.taskTitleChanged",
              )}
              name="taskTitleChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:genericWebhookIntegration.events.taskDescriptionChanged",
              )}
              name="taskDescriptionChanged"
            />
            <EventToggle
              control={form.control}
              label={t(
                "settings:genericWebhookIntegration.events.taskCommentCreated",
              )}
              name="taskCommentCreated"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isBusy} type="submit">
              {isConnected
                ? t("settings:genericWebhookIntegration.saveChanges")
                : t("settings:genericWebhookIntegration.connect")}
            </Button>
            {isConnected && (
              <Button
                disabled={isBusy}
                onClick={handleDelete}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:genericWebhookIntegration.disconnect")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
