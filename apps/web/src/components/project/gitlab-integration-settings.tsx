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
import { GitlabProjectBrowserModal } from "@/components/project/gitlab-project-browser-modal";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { VerifyGitlabAccessResponse } from "@/fetchers/gitlab-integration/verify-gitlab-access";
import {
  useCreateGitlabIntegration,
  useDeleteGitlabIntegration,
  useVerifyGitlabAccess,
} from "@/hooks/mutations/gitlab-integration/use-create-gitlab-integration";
import useImportGitlabIssues from "@/hooks/mutations/gitlab-integration/use-import-gitlab-issues";
import { useUpdateGitlabIntegration } from "@/hooks/mutations/gitlab-integration/use-update-gitlab-integration";
import useGetGitlabIntegration from "@/hooks/queries/gitlab-integration/use-get-gitlab-integration";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

const DEFAULT_GITLAB_URL = "https://gitlab.com";

type GitlabTokenType = "pat" | "oauth2";

type GitlabIntegrationFormValues = {
  baseUrl: string;
  accessToken: string;
  tokenType: GitlabTokenType;
  namespace: string;
  projectPath: string;
};

type GitlabVerificationSnapshot = GitlabIntegrationFormValues;

type GitlabVerificationState = {
  result: VerifyGitlabAccessResponse;
  verified: GitlabVerificationSnapshot;
};

function createVerificationSnapshot(
  values: GitlabIntegrationFormValues,
): GitlabVerificationSnapshot {
  return {
    baseUrl: values.baseUrl.trim(),
    accessToken: values.accessToken.trim(),
    tokenType: values.tokenType,
    namespace: values.namespace.trim(),
    projectPath: values.projectPath.trim(),
  };
}

function snapshotsMatch(
  a: GitlabVerificationSnapshot,
  b: GitlabVerificationSnapshot,
): boolean {
  return (
    a.baseUrl === b.baseUrl &&
    a.accessToken === b.accessToken &&
    a.tokenType === b.tokenType &&
    a.namespace === b.namespace &&
    a.projectPath === b.projectPath
  );
}

export function GitlabIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();

  const gitlabIntegrationSchema = React.useMemo(
    () =>
      z.object({
        baseUrl: z
          .string()
          .min(1, t("settings:gitlabIntegration.validation.baseUrlRequired"))
          .refine((s) => {
            try {
              new URL(s);
              return true;
            } catch {
              return false;
            }
          }, t("settings:gitlabIntegration.validation.baseUrlInvalid")),
        accessToken: z.string(),
        tokenType: z.enum(["pat", "oauth2"]),
        namespace: z
          .string()
          .min(1, t("settings:gitlabIntegration.validation.namespaceRequired"))
          .regex(
            /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/,
            t("settings:gitlabIntegration.validation.namespaceInvalid"),
          ),
        projectPath: z
          .string()
          .min(1, t("settings:gitlabIntegration.validation.pathRequired"))
          .regex(
            /^[a-zA-Z0-9._-]+$/,
            t("settings:gitlabIntegration.validation.pathInvalid"),
          ),
      }),
    [t],
  );

  const {
    data: integration,
    isLoading,
    error: integrationError,
    refetch: refetchIntegration,
  } = useGetGitlabIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGitlabIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGitlabIntegration();
  const { mutateAsync: verifyAccess, isPending: isVerifying } =
    useVerifyGitlabAccess();
  const { mutateAsync: importIssues, isPending: isImporting } =
    useImportGitlabIssues();
  const { mutateAsync: updateGitlabSettings, isPending: isUpdatingSettings } =
    useUpdateGitlabIntegration();

  const [verificationResult, setVerificationResult] =
    React.useState<GitlabVerificationState | null>(null);
  const [showProjectBrowser, setShowProjectBrowser] = React.useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = React.useState(false);

  const form = useForm<GitlabIntegrationFormValues>({
    resolver: standardSchemaResolver(gitlabIntegrationSchema),
    defaultValues: {
      baseUrl: DEFAULT_GITLAB_URL,
      accessToken: "",
      tokenType: "pat",
      namespace: "",
      projectPath: "",
    },
  });

  const resetIntegrationForm = React.useCallback(() => {
    if (!integration?.baseUrl) {
      return;
    }

    form.reset({
      baseUrl: integration.baseUrl,
      accessToken: "",
      tokenType: integration.tokenType,
      namespace: integration.namespace,
      projectPath: integration.projectPath,
    });
    // Clear verify state when the form reloads so import cannot run against
    // stale credentials.
    setVerificationResult(null);
    setShowWebhookSecret(false);
  }, [
    form.reset,
    integration?.baseUrl,
    integration?.tokenType,
    integration?.namespace,
    integration?.projectPath,
  ]);

  React.useEffect(() => {
    resetIntegrationForm();
  }, [resetIntegrationForm]);

  const runVerify = React.useCallback(
    async (data: GitlabIntegrationFormValues, showToast = true) => {
      const token = data.accessToken.trim();
      if (!token && integration) {
        return;
      }
      if (!token && !integration) {
        if (showToast) {
          toast.error(
            t("settings:gitlabIntegration.toast.tokenRequiredVerify"),
          );
        }
        setVerificationResult(null);
        return;
      }
      try {
        const snapshot = createVerificationSnapshot(data);
        const result = await verifyAccess({
          projectId,
          baseUrl: snapshot.baseUrl,
          accessToken: snapshot.accessToken,
          tokenType: snapshot.tokenType,
          namespace: snapshot.namespace,
          projectPath: snapshot.projectPath,
        });
        setVerificationResult({ result, verified: snapshot });
        if (showToast) {
          if (result.isInstalled && result.hasRequiredPermissions) {
            toast.success(t("settings:gitlabIntegration.toast.verifyOk"));
          } else if (result.failureReason === "redirected") {
            toast.error(t("settings:gitlabIntegration.toast.redirected"));
          } else if (result.failureReason === "not_a_gitlab_instance") {
            toast.error(
              t("settings:gitlabIntegration.toast.notGitlabInstance"),
            );
          } else if (result.failureReason === "project_not_found") {
            toast.error(t("settings:gitlabIntegration.toast.projectNotFound"));
          } else {
            toast.warning(t("settings:gitlabIntegration.toast.verifyWarning"));
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("settings:gitlabIntegration.toast.verifyError"),
          );
        }
        setVerificationResult(null);
      }
    },
    [verifyAccess, integration, projectId, t],
  );

  const baseUrl = form.watch("baseUrl");
  const accessToken = form.watch("accessToken");
  const tokenType = form.watch("tokenType");
  const namespace = form.watch("namespace");
  const projectPath = form.watch("projectPath");

  const currentVerificationSnapshot = React.useMemo(
    () =>
      createVerificationSnapshot({
        baseUrl,
        accessToken,
        tokenType,
        namespace,
        projectPath,
      }),
    [baseUrl, accessToken, tokenType, namespace, projectPath],
  );

  React.useEffect(() => {
    setVerificationResult((current) => {
      if (!current) {
        return current;
      }
      return snapshotsMatch(current.verified, currentVerificationSnapshot)
        ? current
        : null;
    });
  }, [currentVerificationSnapshot]);

  React.useEffect(() => {
    const { accessToken: token, baseUrl: url } = currentVerificationSnapshot;
    if (
      !url ||
      !token ||
      !currentVerificationSnapshot.namespace ||
      !currentVerificationSnapshot.projectPath ||
      !form.formState.isValid
    ) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      runVerify(form.getValues(), false);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentVerificationSnapshot,
    form.formState.isValid,
    runVerify,
    form.getValues,
  ]);

  const onSubmit = async (data: GitlabIntegrationFormValues) => {
    try {
      if (!data.accessToken.trim() && !integration) {
        toast.error(t("settings:gitlabIntegration.toast.tokenRequired"));
        return;
      }

      const snapshot = createVerificationSnapshot(data);
      const hasMatchingVerification =
        verificationResult?.result.isInstalled &&
        verificationResult.result.hasRequiredPermissions &&
        snapshotsMatch(verificationResult.verified, snapshot);

      if (data.accessToken.trim() && !hasMatchingVerification) {
        const verification = await verifyAccess({
          projectId,
          baseUrl: snapshot.baseUrl,
          accessToken: snapshot.accessToken,
          tokenType: snapshot.tokenType,
          namespace: snapshot.namespace,
          projectPath: snapshot.projectPath,
        });

        if (!verification.isInstalled || !verification.hasRequiredPermissions) {
          toast.error(t("settings:gitlabIntegration.toast.verifyFirst"));
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
          tokenType: data.tokenType,
          namespace: data.namespace,
          projectPath: data.projectPath,
        },
      });
      form.setValue("accessToken", "");
      toast.success(t("settings:gitlabIntegration.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.updateError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({
        baseUrl: DEFAULT_GITLAB_URL,
        accessToken: "",
        tokenType: "pat",
        namespace: "",
        projectPath: "",
      });
      setVerificationResult(null);
      toast.success(t("settings:gitlabIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.removeError"),
      );
    }
  };

  const handleImportIssues = async () => {
    try {
      await importIssues(projectId);
      toast.success(t("settings:gitlabIntegration.toast.issuesImported"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.importError"),
      );
    }
  };

  const handleProjectSelect = (project: {
    namespace: string;
    projectPath: string;
  }) => {
    form.setValue("namespace", project.namespace, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    form.setValue("projectPath", project.projectPath, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    setShowProjectBrowser(false);
    setVerificationResult(null);
  };

  const handleCopyWebhookSecret = React.useCallback(async () => {
    if (!integration?.webhookSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(integration.webhookSecret);
      toast.success(t("settings:gitlabIntegration.toast.secretCopied"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.unableToCopySecret"),
      );
    }
  }, [integration?.webhookSecret, t]);

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
                : t("settings:gitlabIntegration.toast.updateError")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchIntegration()}
          >
            {t("settings:gitlabIntegration.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const isConnected = !!integration && integration.isActive;
  // Import stays disabled until the user verifies again after changing
  // connection details, so it cannot run with an unverified token.
  const hasVerifiedCurrentValues =
    verificationResult?.result.isInstalled &&
    verificationResult.result.hasRequiredPermissions &&
    snapshotsMatch(verificationResult.verified, currentVerificationSnapshot);
  const canImport = isConnected && Boolean(hasVerifiedCurrentValues);

  const projectUrl =
    integration?.baseUrl && integration.fullPath
      ? `${integration.baseUrl.replace(/\/$/, "")}/${integration.fullPath}`
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings:gitlabIntegration.connectionStatus")}
            </p>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? t("settings:gitlabIntegration.connectedActive")
                : t("settings:gitlabIntegration.notConnectedHint")}
            </p>
          </div>
          {isConnected ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              {t("settings:gitlabIntegration.badgeConnected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <XCircle className="w-3 h-3" />
              {t("settings:gitlabIntegration.badgeNotConnected")}
            </Badge>
          )}
        </div>

        {isConnected && integration && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:gitlabIntegration.project")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:gitlabIntegration.projectHint")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{integration.fullPath}</span>
                {projectUrl && (
                  <a
                    href={projectUrl}
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
                  {t("settings:gitlabIntegration.commentTaskLinkTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:gitlabIntegration.commentTaskLinkHint")}
                </p>
              </div>
              <Switch
                checked={integration.commentTaskLinkOnGitlabIssue ?? true}
                onCheckedChange={async (checked) => {
                  try {
                    await updateGitlabSettings({
                      projectId,
                      json: { commentTaskLinkOnGitlabIssue: checked },
                    });
                    toast.success(
                      checked
                        ? t("settings:gitlabIntegration.toast.commentOnEnabled")
                        : t(
                            "settings:gitlabIntegration.toast.commentOnDisabled",
                          ),
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : t(
                            "settings:gitlabIntegration.toast.settingsUpdateError",
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
                    {t("settings:gitlabIntegration.webhookTitle")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("settings:gitlabIntegration.webhookHint")}
                  </p>
                  <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">
                    {integration.webhookUrl}
                  </code>
                  <p className="text-muted-foreground mt-2">
                    {t("settings:gitlabIntegration.webhookSecretLabel")}
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
                      {showWebhookSecret
                        ? t("settings:gitlabIntegration.webhookHide")
                        : t("settings:gitlabIntegration.webhookShow")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyWebhookSecret}
                    >
                      {t("settings:gitlabIntegration.webhookCopy")}
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
                        {t("settings:gitlabIntegration.baseUrlLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.baseUrlHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-72"
                        placeholder={DEFAULT_GITLAB_URL}
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
              name="tokenType"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:gitlabIntegration.tokenTypeLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.tokenTypeHint")}
                      </p>
                    </div>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isCreating || isDeleting}
                    >
                      <FormControl>
                        <SelectTrigger className="w-72">
                          <SelectValue>
                            {field.value === "oauth2"
                              ? t("settings:gitlabIntegration.tokenTypeOauth2")
                              : t("settings:gitlabIntegration.tokenTypePat")}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pat">
                          {t("settings:gitlabIntegration.tokenTypePat")}
                        </SelectItem>
                        <SelectItem value="oauth2">
                          {t("settings:gitlabIntegration.tokenTypeOauth2")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                        {t("settings:gitlabIntegration.tokenLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.tokenHint")}
                        {integration?.maskedAccessToken
                          ? ` (${t("settings:gitlabIntegration.currentToken")}: ${integration.maskedAccessToken})`
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
                                "settings:gitlabIntegration.tokenPlaceholderUpdate",
                              )
                            : t("settings:gitlabIntegration.tokenPlaceholder")
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
              name="namespace"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:gitlabIntegration.namespaceLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.namespaceHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-64"
                        placeholder="acme/platform"
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
              name="projectPath"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:gitlabIntegration.pathLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.pathHint")}
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
                  {t("settings:gitlabIntegration.actionsTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:gitlabIntegration.actionsHint")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProjectBrowser(true)}
                  className="gap-2"
                  disabled={!baseUrl || !accessToken.trim()}
                >
                  <GitBranch className="size-3" />
                  {t("settings:gitlabIntegration.browse")}
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
                  {t("settings:gitlabIntegration.verify")}
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
                    ? t("settings:gitlabIntegration.update")
                    : t("settings:gitlabIntegration.connect")}
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
                    {t("settings:gitlabIntegration.disconnect")}
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
                  : verificationResult.result.failureReason
                    ? "border-destructive/25 bg-destructive/10"
                    : "border-warning/25 bg-warning/10",
              )}
            >
              {verificationResult.result.isInstalled &&
              verificationResult.result.hasRequiredPermissions ? (
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-foreground" />
              ) : verificationResult.result.failureReason ? (
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive-foreground" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-foreground" />
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
                {t("settings:gitlabIntegration.importSectionTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings:gitlabIntegration.importSectionHint")}
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
                ? t("settings:gitlabIntegration.importing")
                : t("settings:gitlabIntegration.importIssues")}
            </Button>
          </div>
          {!canImport && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                {t("settings:gitlabIntegration.importDisabledHint")}
              </p>
            </>
          )}
        </div>
      )}

      <GitlabProjectBrowserModal
        open={showProjectBrowser}
        projectId={projectId}
        onOpenChange={setShowProjectBrowser}
        onSelectProject={handleProjectSelect}
        selectedProject={
          namespace && projectPath ? `${namespace}/${projectPath}` : undefined
        }
        baseUrl={baseUrl}
        accessToken={accessToken}
        tokenType={tokenType}
      />
    </div>
  );
}
