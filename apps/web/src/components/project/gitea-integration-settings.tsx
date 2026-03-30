import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  GitBranch,
  Import,
  Link,
  RefreshCw,
  Unlink,
  XCircle,
} from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { GiteaRepositoryBrowserModal } from "@/components/project/gitea-repository-browser-modal";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { VerifyGiteaAccessResponse } from "@/fetchers/gitea-integration/verify-gitea-access";
import {
  useCreateGiteaIntegration,
  useDeleteGiteaIntegration,
  useVerifyGiteaAccess,
} from "@/hooks/mutations/gitea-integration/use-create-gitea-integration";
import useImportGiteaIssues from "@/hooks/mutations/gitea-integration/use-import-gitea-issues";
import { useUpdateGiteaIntegration } from "@/hooks/mutations/gitea-integration/use-update-gitea-integration";
import useGetGiteaIntegration from "@/hooks/queries/gitea-integration/use-get-gitea-integration";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type GiteaIntegrationFormValues = {
  baseUrl: string;
  accessToken: string;
  repositoryOwner: string;
  repositoryName: string;
};

type GiteaVerificationSnapshot = {
  baseUrl: string;
  accessToken: string;
  repositoryOwner: string;
  repositoryName: string;
};

type GiteaVerificationState = {
  result: VerifyGiteaAccessResponse;
  verified: GiteaVerificationSnapshot;
};

function createVerificationSnapshot(
  values: GiteaIntegrationFormValues,
): GiteaVerificationSnapshot {
  return {
    baseUrl: values.baseUrl.trim(),
    accessToken: values.accessToken.trim(),
    repositoryOwner: values.repositoryOwner.trim(),
    repositoryName: values.repositoryName.trim(),
  };
}

export function GiteaIntegrationSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation();

  const giteaIntegrationSchema = React.useMemo(
    () =>
      z.object({
        baseUrl: z
          .string()
          .min(1, t("settings:giteaIntegration.validation.baseUrlRequired"))
          .refine((s) => {
            try {
              new URL(s);
              return true;
            } catch {
              return false;
            }
          }, t("settings:giteaIntegration.validation.baseUrlInvalid")),
        accessToken: z.string(),
        repositoryOwner: z
          .string()
          .min(1, t("settings:giteaIntegration.validation.ownerRequired"))
          .regex(
            /^[a-zA-Z0-9_.-]+$/,
            t("settings:giteaIntegration.validation.ownerInvalid"),
          ),
        repositoryName: z
          .string()
          .min(1, t("settings:giteaIntegration.validation.nameRequired"))
          .regex(
            /^[a-zA-Z0-9._-]+$/,
            t("settings:giteaIntegration.validation.nameInvalid"),
          ),
      }),
    [t],
  );

  const {
    data: integration,
    isLoading,
    error: integrationError,
    refetch: refetchIntegration,
  } = useGetGiteaIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGiteaIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGiteaIntegration();
  const { mutateAsync: verifyAccess, isPending: isVerifying } =
    useVerifyGiteaAccess();
  const { mutateAsync: importIssues, isPending: isImporting } =
    useImportGiteaIssues();
  const { mutateAsync: updateGiteaSettings, isPending: isUpdatingSettings } =
    useUpdateGiteaIntegration();

  const [verificationResult, setVerificationResult] =
    React.useState<GiteaVerificationState | null>(null);
  const [showRepositoryBrowser, setShowRepositoryBrowser] =
    React.useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = React.useState(false);

  const form = useForm<GiteaIntegrationFormValues>({
    resolver: standardSchemaResolver(giteaIntegrationSchema),
    defaultValues: {
      baseUrl: "",
      accessToken: "",
      repositoryOwner: "",
      repositoryName: "",
    },
  });

  const resetIntegrationForm = React.useCallback(() => {
    if (!integration?.baseUrl) {
      return;
    }

    form.reset({
      baseUrl: integration.baseUrl,
      accessToken: "",
      repositoryOwner: integration.repositoryOwner,
      repositoryName: integration.repositoryName,
    });
    setVerificationResult(null);
    setShowWebhookSecret(false);
  }, [
    form.reset,
    integration?.baseUrl,
    integration?.repositoryOwner,
    integration?.repositoryName,
  ]);

  React.useEffect(() => {
    resetIntegrationForm();
  }, [resetIntegrationForm]);

  const runVerify = React.useCallback(
    async (data: GiteaIntegrationFormValues, showToast = true) => {
      const token = data.accessToken.trim();
      if (!token && integration) {
        return;
      }
      if (!token && !integration) {
        if (showToast) {
          toast.error(t("settings:giteaIntegration.toast.tokenRequiredVerify"));
        }
        setVerificationResult(null);
        return;
      }
      try {
        const snapshot = createVerificationSnapshot(data);
        const result = await verifyAccess({
          baseUrl: snapshot.baseUrl,
          accessToken: snapshot.accessToken,
          repositoryOwner: snapshot.repositoryOwner,
          repositoryName: snapshot.repositoryName,
        });
        setVerificationResult({
          result,
          verified: snapshot,
        });
        if (showToast) {
          if (result.isInstalled && result.hasRequiredPermissions) {
            toast.success(t("settings:giteaIntegration.toast.verifyOk"));
          } else if (!result.repositoryExists) {
            toast.error(t("settings:giteaIntegration.toast.repoNotFound"));
          } else {
            toast.warning(t("settings:giteaIntegration.toast.verifyWarning"));
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("settings:giteaIntegration.toast.verifyError"),
          );
        }
        setVerificationResult(null);
      }
    },
    [verifyAccess, integration, t],
  );

  const baseUrl = form.watch("baseUrl");
  const accessToken = form.watch("accessToken");
  const repositoryOwner = form.watch("repositoryOwner");
  const repositoryName = form.watch("repositoryName");
  const currentVerificationSnapshot = React.useMemo(
    () =>
      createVerificationSnapshot({
        baseUrl,
        accessToken,
        repositoryOwner,
        repositoryName,
      }),
    [baseUrl, accessToken, repositoryOwner, repositoryName],
  );

  React.useEffect(() => {
    setVerificationResult((current) => {
      if (!current) {
        return current;
      }

      const stillMatches =
        current.verified.baseUrl === currentVerificationSnapshot.baseUrl &&
        current.verified.accessToken ===
          currentVerificationSnapshot.accessToken &&
        current.verified.repositoryOwner ===
          currentVerificationSnapshot.repositoryOwner &&
        current.verified.repositoryName ===
          currentVerificationSnapshot.repositoryName;

      return stillMatches ? current : null;
    });
  }, [currentVerificationSnapshot]);

  React.useEffect(() => {
    if (
      !baseUrl ||
      !repositoryOwner ||
      !repositoryName ||
      !form.formState.isValid
    ) {
      return;
    }
    if (!accessToken.trim()) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      runVerify(form.getValues(), false);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    baseUrl,
    repositoryOwner,
    repositoryName,
    accessToken,
    form.formState.isValid,
    runVerify,
    form.getValues,
  ]);

  const onSubmit = async (data: GiteaIntegrationFormValues) => {
    try {
      if (!data.accessToken.trim() && !integration) {
        toast.error(t("settings:giteaIntegration.toast.tokenRequired"));
        return;
      }

      const snapshot = createVerificationSnapshot(data);
      const hasMatchingVerification =
        verificationResult?.result.isInstalled &&
        verificationResult.result.hasRequiredPermissions &&
        verificationResult.verified.baseUrl === snapshot.baseUrl &&
        verificationResult.verified.accessToken === snapshot.accessToken &&
        verificationResult.verified.repositoryOwner ===
          snapshot.repositoryOwner &&
        verificationResult.verified.repositoryName === snapshot.repositoryName;

      if (data.accessToken.trim() && !hasMatchingVerification) {
        const verification = await verifyAccess({
          baseUrl: snapshot.baseUrl,
          accessToken: snapshot.accessToken,
          repositoryOwner: snapshot.repositoryOwner,
          repositoryName: snapshot.repositoryName,
        });

        if (!verification.isInstalled || !verification.hasRequiredPermissions) {
          toast.error(t("settings:giteaIntegration.toast.verifyFirst"));
          return;
        }
      }

      await createIntegration({
        projectId,
        data: {
          baseUrl: data.baseUrl,
          ...(data.accessToken.trim()
            ? { accessToken: data.accessToken.trim() }
            : {}),
          repositoryOwner: data.repositoryOwner,
          repositoryName: data.repositoryName,
        },
      });
      form.setValue("accessToken", "");
      toast.success(t("settings:giteaIntegration.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:giteaIntegration.toast.updateError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({
        baseUrl: "",
        accessToken: "",
        repositoryOwner: "",
        repositoryName: "",
      });
      setVerificationResult(null);
      toast.success(t("settings:giteaIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:giteaIntegration.toast.removeError"),
      );
    }
  };

  const handleImportIssues = async () => {
    try {
      await importIssues(projectId);
      toast.success(t("settings:giteaIntegration.toast.issuesImported"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:giteaIntegration.toast.importError"),
      );
    }
  };

  const handleRepositorySelect = (repository: {
    owner: string;
    name: string;
  }) => {
    form.setValue("repositoryOwner", repository.owner, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    form.setValue("repositoryName", repository.name, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    setShowRepositoryBrowser(false);
    setVerificationResult(null);
  };

  const handleCopyWebhookSecret = React.useCallback(async () => {
    if (!integration?.webhookSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(integration.webhookSecret);
      toast.success("Copied");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to copy secret",
      );
    }
  }, [integration?.webhookSecret]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse w-full" />
      </div>
    );
  }

  if (integrationError) {
    return (
      <div className="space-y-4 border border-destructive/25 rounded-md p-4 bg-sidebar">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">
              {t("common:error.title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {integrationError instanceof Error
                ? integrationError.message
                : t("settings:giteaIntegration.toast.updateError")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchIntegration()}
          >
            {t("settings:giteaIntegration.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const isConnected = !!integration && integration.isActive;
  const hasVerifiedCurrentValues =
    verificationResult?.result.isInstalled &&
    verificationResult.result.hasRequiredPermissions &&
    verificationResult.verified.baseUrl ===
      currentVerificationSnapshot.baseUrl &&
    verificationResult.verified.accessToken ===
      currentVerificationSnapshot.accessToken &&
    verificationResult.verified.repositoryOwner ===
      currentVerificationSnapshot.repositoryOwner &&
    verificationResult.verified.repositoryName ===
      currentVerificationSnapshot.repositoryName;
  const canImport = isConnected && Boolean(hasVerifiedCurrentValues);

  const repoUrl =
    integration?.baseUrl && integration.repositoryOwner
      ? `${integration.baseUrl.replace(/\/$/, "")}/${integration.repositoryOwner}/${integration.repositoryName}`
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings:giteaIntegration.connectionStatus")}
            </p>
            {isConnected ? (
              <p className="text-xs text-muted-foreground">
                {t("settings:giteaIntegration.connectedActive")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("settings:giteaIntegration.notConnectedHint")}
              </p>
            )}
          </div>
          {isConnected ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              {t("settings:giteaIntegration.badgeConnected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <XCircle className="w-3 h-3" />
              {t("settings:giteaIntegration.badgeNotConnected")}
            </Badge>
          )}
        </div>

        {isConnected && integration && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:giteaIntegration.repository")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:giteaIntegration.repositoryHint")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {integration.repositoryOwner}/{integration.repositoryName}
                </span>
                {repoUrl && (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:giteaIntegration.commentTaskLinkTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:giteaIntegration.commentTaskLinkHint")}
                </p>
              </div>
              <Switch
                checked={integration.commentTaskLinkOnGiteaIssue !== false}
                onCheckedChange={async (checked) => {
                  try {
                    await updateGiteaSettings({
                      projectId,
                      json: { commentTaskLinkOnGiteaIssue: checked },
                    });
                    toast.success(
                      checked
                        ? t("settings:giteaIntegration.toast.commentOnEnabled")
                        : t(
                            "settings:giteaIntegration.toast.commentOnDisabled",
                          ),
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : t(
                            "settings:giteaIntegration.toast.settingsUpdateError",
                          ),
                    );
                  }
                }}
                disabled={isUpdatingSettings}
              />
            </div>

            {integration.webhookUrl && (
              <>
                <Separator />
                <div className="space-y-2 text-xs">
                  <p className="font-medium text-sm">
                    {t("settings:giteaIntegration.webhookTitle")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("settings:giteaIntegration.webhookHint")}
                  </p>
                  <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">
                    {integration.webhookUrl}
                  </code>
                  <p className="text-muted-foreground mt-2">
                    {t("settings:giteaIntegration.webhookSecretLabel")}
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-[11px]">
                      {showWebhookSecret
                        ? integration.webhookSecret
                        : "••••••••••••••••••••••••••••••••"}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setShowWebhookSecret((current) => !current)
                      }
                    >
                      {showWebhookSecret ? "Hide" : "Show"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyWebhookSecret}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:giteaIntegration.baseUrlLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:giteaIntegration.baseUrlHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-72"
                        placeholder="https://gitea.example.com"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="accessToken"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:giteaIntegration.tokenLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:giteaIntegration.tokenHint")}
                        {integration?.maskedAccessToken
                          ? ` (${t("settings:giteaIntegration.currentToken")}: ${integration.maskedAccessToken})`
                          : null}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-72"
                        type="password"
                        autoComplete="off"
                        placeholder={
                          integration
                            ? t(
                                "settings:giteaIntegration.tokenPlaceholderUpdate",
                              )
                            : t("settings:giteaIntegration.tokenPlaceholder")
                        }
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="repositoryOwner"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:giteaIntegration.ownerLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:giteaIntegration.ownerHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-64"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="repositoryName"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:giteaIntegration.repoNameLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:giteaIntegration.repoNameHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-64"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:giteaIntegration.actionsTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:giteaIntegration.actionsHint")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRepositoryBrowser(true)}
                  className="gap-2"
                  disabled={!baseUrl || !accessToken.trim()}
                >
                  <GitBranch className="size-3" />
                  {t("settings:giteaIntegration.browse")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runVerify(form.getValues())}
                  disabled={
                    isVerifying ||
                    !form.formState.isValid ||
                    (!accessToken.trim() && !integration)
                  }
                  className="gap-2"
                >
                  <RefreshCw
                    className={cn("size-3", isVerifying && "animate-spin")}
                  />
                  {t("settings:giteaIntegration.verify")}
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isCreating ||
                    isDeleting ||
                    !form.formState.isValid ||
                    (verificationResult ? !hasVerifiedCurrentValues : false)
                  }
                  className="gap-2"
                >
                  <Link className="size-3" />
                  {isConnected
                    ? t("settings:giteaIntegration.update")
                    : t("settings:giteaIntegration.connect")}
                </Button>

                {isConnected && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isCreating || isDeleting}
                    className="gap-2"
                  >
                    <Unlink className="size-3" />
                    {t("settings:giteaIntegration.disconnect")}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>

        {verificationResult && (
          <>
            <Separator />
            <div
              className={cn(
                "flex items-start gap-3 p-3 border rounded-md text-sm",
                verificationResult.result.isInstalled &&
                  verificationResult.result.hasRequiredPermissions
                  ? "border-success/25 bg-success/10"
                  : verificationResult.result.repositoryExists
                    ? "border-warning/25 bg-warning/10"
                    : "border-destructive/25 bg-destructive/10",
              )}
            >
              {verificationResult.result.isInstalled &&
              verificationResult.result.hasRequiredPermissions ? (
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-foreground" />
              ) : verificationResult.result.repositoryExists ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-foreground" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive-foreground" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {verificationResult.result.message}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {isConnected && (
        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings:giteaIntegration.importSectionTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings:giteaIntegration.importSectionHint")}
              </p>
            </div>
            <Button
              onClick={handleImportIssues}
              disabled={isImporting || !canImport}
              className="gap-2"
              size="sm"
              variant="outline"
            >
              {isImporting ? (
                <RefreshCw className="size-3 animate-spin" />
              ) : (
                <Import className="size-3" />
              )}
              {isImporting
                ? t("settings:giteaIntegration.importing")
                : t("settings:giteaIntegration.importIssues")}
            </Button>
          </div>
          {!canImport && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                {t("settings:giteaIntegration.importDisabledHint")}
              </p>
            </>
          )}
        </div>
      )}

      <GiteaRepositoryBrowserModal
        open={showRepositoryBrowser}
        onOpenChange={setShowRepositoryBrowser}
        onSelectRepository={handleRepositorySelect}
        selectedRepository={
          repositoryOwner && repositoryName
            ? `${repositoryOwner}/${repositoryName}`
            : undefined
        }
        baseUrl={baseUrl}
        accessToken={accessToken}
      />
    </div>
  );
}
