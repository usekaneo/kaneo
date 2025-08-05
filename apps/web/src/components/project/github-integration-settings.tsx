import { RepositoryBrowserModal } from "@/components/project/repository-browser-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { VerifyGithubInstallationResponse } from "@/fetchers/github-integration/verify-github-installation";
import {
  useCreateGithubIntegration,
  useDeleteGithubIntegration,
  useVerifyGithubInstallation,
} from "@/hooks/mutations/github-integration/use-create-github-integration";
import useImportGithubIssues from "@/hooks/mutations/github-integration/use-import-github-issues";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import { cn } from "@/lib/cn";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  Import,
  Link,
  RefreshCw,
  Settings,
  Unlink,
  XCircle,
} from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

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
}: { projectId: string }) {
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
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Github className="w-6 h-6" />
              </div>
              <div>
                <div className="h-5 bg-gray-200 rounded animate-pulse w-40" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-64 mt-2" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConnected = !!integration && integration.isActive;
  const canImport =
    isConnected &&
    verificationResult?.isInstalled &&
    verificationResult?.hasRequiredPermissions;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connection Status</CardTitle>
            {isConnected && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Github className="w-4 h-4" />
                <span className="font-medium">
                  {integration.repositoryOwner}/{integration.repositoryName}
                </span>
                <a
                  href={`https://github.com/${integration.repositoryOwner}/${integration.repositoryName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {verificationResult && (
                <div className="flex items-center gap-2 text-sm">
                  {verificationResult.isInstalled &&
                  verificationResult.hasRequiredPermissions ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-700">
                        App properly configured
                      </span>
                    </>
                  ) : verificationResult.isInstalled ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-amber-700">
                        Missing permissions
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-700">App not installed</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No repository connected. Configure a repository below to get
              started.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Repository Configuration
          </CardTitle>
          <CardDescription>
            Connect to a GitHub repository to enable issue synchronization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="repositoryOwner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository Owner</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., octocat"
                          {...field}
                          disabled={isCreating || isDeleting}
                        />
                      </FormControl>
                      <FormDescription>
                        GitHub username or organization
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="repositoryName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., my-project"
                          {...field}
                          disabled={isCreating || isDeleting}
                        />
                      </FormControl>
                      <FormDescription>The repository name</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRepositoryBrowser(true)}
                  className="gap-2"
                >
                  <GitBranch className="w-4 h-4" />
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
                    className={cn("w-4 h-4", isVerifying && "animate-spin")}
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
                  <Link className="w-4 h-4" />
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
                    <Unlink className="w-4 h-4" />
                    Disconnect
                  </Button>
                )}
              </div>
            </form>
          </Form>

          {verificationResult && (
            <div className="mt-4">
              <div
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-lg text-sm",
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
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4" />
              Actions
            </CardTitle>
            <CardDescription>
              Import existing issues from GitHub or manage your integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/20 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                  <Import className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                    Import GitHub Issues
                  </h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Import existing issues from your GitHub repository as tasks
                    in this project.
                  </p>
                  <Button
                    onClick={handleImportIssues}
                    disabled={isImporting || !canImport}
                    className="gap-2"
                    size="sm"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Import className="w-4 h-4" />
                    )}
                    {isImporting ? "Importing..." : "Import Issues"}
                  </Button>
                  {!canImport && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                      Complete the repository configuration above to enable
                      importing
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
