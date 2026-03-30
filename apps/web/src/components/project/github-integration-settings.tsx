import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  GitBranch,
  Github,
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
import { RepositoryBrowserModal } from "@/components/project/repository-browser-modal";
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
import type { VerifyGithubInstallationResponse } from "@/fetchers/github-integration/verify-github-installation";
import {
  useCreateGithubIntegration,
  useDeleteGithubIntegration,
  useVerifyGithubInstallation,
} from "@/hooks/mutations/github-integration/use-create-github-integration";
import useImportGithubIssues from "@/hooks/mutations/github-integration/use-import-github-issues";
import { useUpdateGithubIntegration } from "@/hooks/mutations/github-integration/use-update-github-integration";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type GithubIntegrationFormValues = {
  repositoryOwner: string;
  repositoryName: string;
};

export function GitHubIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const githubIntegrationSchema = React.useMemo(
    () =>
      z.object({
        repositoryOwner: z
          .string()
          .min(1, t("settings:githubIntegration.validation.ownerRequired"))
          .regex(
            /^[a-zA-Z0-9-]+$/,
            t("settings:githubIntegration.validation.ownerInvalid"),
          ),
        repositoryName: z
          .string()
          .min(1, t("settings:githubIntegration.validation.nameRequired"))
          .regex(
            /^[a-zA-Z0-9._-]+$/,
            t("settings:githubIntegration.validation.nameInvalid"),
          ),
      }),
    [t],
  );

  const { data: integration, isLoading } = useGetGithubIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGithubIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGithubIntegration();
  const { mutateAsync: verifyInstallation, isPending: isVerifying } =
    useVerifyGithubInstallation();
  const { mutateAsync: importIssues, isPending: isImporting } =
    useImportGithubIssues();
  const { mutateAsync: updateGithubSettings, isPending: isUpdatingSettings } =
    useUpdateGithubIntegration();

  const [verificationResult, setVerificationResult] =
    React.useState<VerifyGithubInstallationResponse | null>(null);
  const [showRepositoryBrowser, setShowRepositoryBrowser] =
    React.useState(false);

  const form = useForm<GithubIntegrationFormValues>({
    resolver: standardSchemaResolver(githubIntegrationSchema),
    defaultValues: {
      repositoryOwner: integration?.repositoryOwner || "",
      repositoryName: integration?.repositoryName || "",
    },
  });

  React.useEffect(() => {
    if (integration) {
      form.reset({
        repositoryOwner: integration.repositoryOwner,
        repositoryName: integration.repositoryName,
      });
    }
  }, [integration, form]);

  const repositoryOwner = form.watch("repositoryOwner");
  const repositoryName = form.watch("repositoryName");

  const handleVerifyInstallation = React.useCallback(
    async (data: GithubIntegrationFormValues, showToast = true) => {
      try {
        const result = await verifyInstallation(data);
        setVerificationResult(result);

        if (showToast) {
          if (result.isInstalled && result.hasRequiredPermissions) {
            toast.success(t("settings:githubIntegration.toast.installedOk"));
          } else if (result.isInstalled) {
            toast.warning(
              t("settings:githubIntegration.toast.installedMissingPerms"),
            );
          } else if (result.repositoryExists) {
            toast.warning(
              t("settings:githubIntegration.toast.needsInstallOnRepo"),
            );
          } else {
            toast.error(t("settings:githubIntegration.toast.repoNotFound"));
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("settings:githubIntegration.toast.verifyError"),
          );
        }
        setVerificationResult(null);
      }
    },
    [verifyInstallation, t],
  );

  React.useEffect(() => {
    if (repositoryOwner && repositoryName && form.formState.isValid) {
      handleVerifyInstallation({ repositoryOwner, repositoryName }, false);
    }
  }, [
    repositoryOwner,
    repositoryName,
    form.formState.isValid,
    handleVerifyInstallation,
  ]);

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

  const onSubmit = async (data: GithubIntegrationFormValues) => {
    try {
      const verification = await verifyInstallation(data);

      if (!verification.isInstalled) {
        toast.error(t("settings:githubIntegration.toast.installAppFirst"));
        return;
      }

      if (!verification.hasRequiredPermissions) {
        toast.error(
          t("settings:githubIntegration.toast.missingPermsDetail", {
            list: verification.missingPermissions?.join(", ") || "issues",
          }),
        );
        return;
      }

      await createIntegration({
        projectId,
        data,
      });
      toast.success(t("settings:githubIntegration.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.updateError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({ repositoryOwner: "", repositoryName: "" });
      setVerificationResult(null);
      toast.success(t("settings:githubIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.removeError"),
      );
    }
  };

  const handleImportIssues = async () => {
    try {
      await importIssues({ projectId });
      toast.success(t("settings:githubIntegration.toast.issuesImported"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.importError"),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded animate-pulse w-40" />
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-10 bg-muted rounded animate-pulse w-full" />
          </div>
        </div>
        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded animate-pulse w-40" />
            <div className="h-10 bg-muted rounded animate-pulse w-full" />
            <div className="h-10 bg-muted rounded animate-pulse w-full" />
          </div>
        </div>
      </div>
    );
  }

  const isConnected = !!integration && integration.isActive;
  const canImport =
    isConnected &&
    verificationResult?.isInstalled &&
    verificationResult?.hasRequiredPermissions;

  return (
    <div className="space-y-4">
      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings:githubIntegration.connectionStatus")}
            </p>
            {isConnected ? (
              <p className="text-xs text-muted-foreground">
                {t("settings:githubIntegration.connectedActive")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("settings:githubIntegration.notConnectedHint")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {t("settings:githubIntegration.badgeConnected")}
                </Badge>
              </div>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircle className="w-3 h-3" />
                {t("settings:githubIntegration.badgeNotConnected")}
              </Badge>
            )}
          </div>
        </div>

        {isConnected && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:githubIntegration.repository")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:githubIntegration.repositoryHint")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Github className="w-4 h-4" />
                <span className="font-medium">
                  {integration.repositoryOwner}/{integration.repositoryName}
                </span>
                <a
                  href={`https://github.com/${integration.repositoryOwner}/${integration.repositoryName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:githubIntegration.commentTaskLinkTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:githubIntegration.commentTaskLinkHint")}
                </p>
              </div>
              <Switch
                checked={integration.commentTaskLinkOnGitHubIssue !== false}
                onCheckedChange={async (checked) => {
                  try {
                    await updateGithubSettings({
                      projectId,
                      json: { commentTaskLinkOnGitHubIssue: checked },
                    });
                    toast.success(
                      checked
                        ? t("settings:githubIntegration.toast.commentOnEnabled")
                        : t(
                            "settings:githubIntegration.toast.commentOnDisabled",
                          ),
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : t(
                            "settings:githubIntegration.toast.settingsUpdateError",
                          ),
                    );
                  }
                }}
                disabled={isUpdatingSettings}
              />
            </div>
          </>
        )}

        {isConnected && verificationResult && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:githubIntegration.appStatusTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:githubIntegration.appStatusHint")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {verificationResult.isInstalled &&
                verificationResult.hasRequiredPermissions ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-success-foreground" />
                    <span className="font-medium text-success-foreground">
                      {t("settings:githubIntegration.statusProperlyConfigured")}
                    </span>
                  </>
                ) : verificationResult.isInstalled ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                    <span className="font-medium text-warning-foreground">
                      {t("settings:githubIntegration.statusMissingPermissions")}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive-foreground" />
                    <span className="font-medium text-destructive-foreground">
                      {t("settings:githubIntegration.statusNotInstalled")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="repositoryOwner"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:githubIntegration.ownerLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:githubIntegration.ownerHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-64"
                        placeholder={t(
                          "settings:githubIntegration.ownerPlaceholder",
                        )}
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
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:githubIntegration.repoNameLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:githubIntegration.repoNameHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-64"
                        placeholder={t(
                          "settings:githubIntegration.repoNamePlaceholder",
                        )}
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
                  {t("settings:githubIntegration.actionsTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:githubIntegration.actionsHint")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRepositoryBrowser(true)}
                  className="gap-2"
                >
                  <GitBranch className="size-3" />
                  {t("settings:githubIntegration.browse")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyInstallation(form.getValues())}
                  disabled={isVerifying || !form.formState.isValid}
                  className="gap-2"
                >
                  <RefreshCw
                    className={cn("size-3", isVerifying && "animate-spin")}
                  />
                  {t("settings:githubIntegration.verify")}
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isCreating ||
                    isDeleting ||
                    !form.formState.isValid ||
                    (verificationResult
                      ? !verificationResult.isInstalled ||
                        !verificationResult.hasRequiredPermissions
                      : false)
                  }
                  className="gap-2"
                >
                  <Link className="size-3" />
                  {isConnected
                    ? t("settings:githubIntegration.update")
                    : t("settings:githubIntegration.connect")}
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
                    {t("settings:githubIntegration.disconnect")}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>

        {verificationResult && (
          <>
            <Separator />
            <div className="space-y-2">
              <div
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-md text-sm",
                  verificationResult.isInstalled &&
                    verificationResult.hasRequiredPermissions
                    ? "border-success/25 bg-success/10"
                    : verificationResult.isInstalled
                      ? "border-warning/25 bg-warning/10"
                      : verificationResult.repositoryExists
                        ? "border-warning/25 bg-warning/10"
                        : "border-destructive/25 bg-destructive/10",
                )}
              >
                {verificationResult.isInstalled &&
                verificationResult.hasRequiredPermissions ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-foreground" />
                ) : verificationResult.isInstalled ||
                  verificationResult.repositoryExists ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-foreground" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive-foreground" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{verificationResult.message}</p>

                  {verificationResult.isInstalled &&
                    !verificationResult.hasRequiredPermissions &&
                    verificationResult.missingPermissions && (
                      <div className="mt-2">
                        <p className="text-xs mb-2">
                          {t(
                            "settings:githubIntegration.missingPermissionsLabel",
                          )}{" "}
                          <strong>
                            {verificationResult.missingPermissions.join(", ")}
                          </strong>
                        </p>
                        <div className="flex gap-2">
                          {verificationResult.settingsUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  verificationResult.settingsUrl,
                                  "_blank",
                                )
                              }
                              className="gap-2"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {t(
                                "settings:githubIntegration.updatePermissions",
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                  {!verificationResult.isInstalled &&
                    verificationResult.repositoryExists && (
                      <div className="mt-2">
                        {verificationResult.installationUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                verificationResult.installationUrl,
                                "_blank",
                              )
                            }
                            className="gap-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {t("settings:githubIntegration.installGithubApp")}
                          </Button>
                        )}
                      </div>
                    )}
                </div>
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
                {t("settings:githubIntegration.importSectionTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings:githubIntegration.importSectionHint")}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                  ? t("settings:githubIntegration.importing")
                  : t("settings:githubIntegration.importIssues")}
              </Button>
            </div>
          </div>
          {!canImport && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                {t("settings:githubIntegration.importDisabledHint")}
              </p>
            </>
          )}
        </div>
      )}

      <RepositoryBrowserModal
        open={showRepositoryBrowser}
        onOpenChange={setShowRepositoryBrowser}
        onSelectRepository={handleRepositorySelect}
        selectedRepository={
          repositoryOwner && repositoryName
            ? `${repositoryOwner}/${repositoryName}`
            : undefined
        }
      />
    </div>
  );
}
