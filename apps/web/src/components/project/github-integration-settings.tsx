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
import { toast } from "sonner";
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
import type { VerifyGithubInstallationResponse } from "@/fetchers/github-integration/verify-github-installation";
import {
  useCreateGithubIntegration,
  useDeleteGithubIntegration,
  useVerifyGithubInstallation,
} from "@/hooks/mutations/github-integration/use-create-github-integration";
import useImportGithubIssues from "@/hooks/mutations/github-integration/use-import-github-issues";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import { cn } from "@/lib/cn";

const githubIntegrationSchema = z.object({
  repositoryOwner: z
    .string()
    .min(1, "Repository owner is required")
    .regex(/^[a-zA-Z0-9-]+$/, "Invalid repository owner format"),
  repositoryName: z
    .string()
    .min(1, "Repository name is required")
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid repository name format"),
});

type GithubIntegrationFormValues = z.infer<typeof githubIntegrationSchema>;

export function GitHubIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { data: integration, isLoading } = useGetGithubIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGithubIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGithubIntegration();
  const { mutateAsync: verifyInstallation, isPending: isVerifying } =
    useVerifyGithubInstallation();
  const { mutateAsync: importIssues, isPending: isImporting } =
    useImportGithubIssues();

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
            toast.success("GitHub App is properly installed!");
          } else if (result.isInstalled) {
            toast.warning(
              "GitHub App is installed but missing required permissions",
            );
          } else if (result.repositoryExists) {
            toast.warning(
              "GitHub App needs to be installed on this repository",
            );
          } else {
            toast.error("Repository not found or not accessible");
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to verify GitHub installation",
          );
        }
        setVerificationResult(null);
      }
    },
    [verifyInstallation],
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
        toast.error("Please install the GitHub App on this repository first");
        return;
      }

      if (!verification.hasRequiredPermissions) {
        toast.error(
          `GitHub App is missing required permissions: ${verification.missingPermissions?.join(", ") || "issues"}. Please update the app permissions.`,
        );
        return;
      }

      await createIntegration({
        projectId,
        data,
      });
      toast.success("GitHub integration updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update GitHub integration",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({ repositoryOwner: "", repositoryName: "" });
      setVerificationResult(null);
      toast.success("GitHub integration removed successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove GitHub integration",
      );
    }
  };

  const handleImportIssues = async () => {
    try {
      await importIssues({ projectId });
      toast.success("Issues imported successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import issues",
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
            <p className="text-sm font-medium">Connection Status</p>
            {isConnected ? (
              <p className="text-xs text-muted-foreground">
                Repository connected and active
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No repository connected
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </Badge>
              </div>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircle className="w-3 h-3" />
                Not Connected
              </Badge>
            )}
          </div>
        </div>

        {isConnected && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Repository</p>
                <p className="text-xs text-muted-foreground">
                  Connected GitHub repository
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
          </>
        )}

        {isConnected && verificationResult && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">GitHub App Status</p>
                <p className="text-xs text-muted-foreground">
                  Installation and permissions status
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {verificationResult.isInstalled &&
                verificationResult.hasRequiredPermissions ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 font-medium">
                      Properly configured
                    </span>
                  </>
                ) : verificationResult.isInstalled ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-600 font-medium">
                      Missing permissions
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 font-medium">
                      Not installed
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
                        Repository Owner
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        GitHub username or organization
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-64"
                        placeholder="e.g., octocat"
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
                        Repository Name
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        The repository name
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-64"
                        placeholder="e.g., my-project"
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
                <p className="text-sm font-medium">Actions</p>
                <p className="text-xs text-muted-foreground">
                  Manage your repository connection
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
                  Browse
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
                  Verify
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
                  {isConnected ? "Update" : "Connect"}
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
                    Disconnect
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
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : verificationResult.isInstalled
                      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                      : verificationResult.repositoryExists
                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                )}
              >
                {verificationResult.isInstalled &&
                verificationResult.hasRequiredPermissions ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                ) : verificationResult.isInstalled ||
                  verificationResult.repositoryExists ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{verificationResult.message}</p>

                  {verificationResult.isInstalled &&
                    !verificationResult.hasRequiredPermissions &&
                    verificationResult.missingPermissions && (
                      <div className="mt-2">
                        <p className="text-xs mb-2">
                          Missing permissions:{" "}
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
                              Update Permissions
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
                            Install GitHub App
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
              <p className="text-sm font-medium">Import GitHub Issues</p>
              <p className="text-xs text-muted-foreground">
                Import existing issues from your GitHub repository as tasks
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
                {isImporting ? "Importing..." : "Import Issues"}
              </Button>
            </div>
          </div>
          {!canImport && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Complete the repository configuration above to enable importing
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
